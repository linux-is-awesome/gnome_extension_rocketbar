/**
 * @typedef {import('gi://St').Widget} St.Widget
 * @typedef {import('../base/component.js').Component<St.Widget>} Component
 * @typedef {{competitor: Component, rect: Mtk.Rectangle}} DropCompetitor
 */

import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import { XdndHandler } from '../../core/shell.js';
import Context from '../../core/context.js';
import { AppButton } from './appButton.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { Event, Delay, PseudoClass } from '../../../shared/enums/general.js';

/**
 * @param {Component} competitor
 * @param {number} offset
 * @returns {{competitor: Component, rect: Mtk.Rectangle}}
 */
const DropCompetitor = (competitor, offset) => {
    const rect = competitor.rect ?? new Mtk.Rectangle();
    rect.x = offset;
    return { competitor, rect };
};

class DragActor {

    /** @type {Clutter.Actor?} */
    #actor = null;

    /** @type {{[prop: string]: *}?} */
    #actorProps = null;

    /** @type {Clutter.Clone?} */
    #actorClone = null;

    /** @type {boolean} */
    #isVisible = true;

    /** @type {{x: number, y: number, width: number, height: number}?} */
    get #actorRect() {
        if (!this.#actor) return null;
        const { x, y, width, height } = this.#actor;
        return { x, y, width, height };
    }

    /** @type {Mtk.Rectangle?} */
    get rect() {
        if (!this.#actor) return null;
        const result = new Mtk.Rectangle();
        [result.x, result.y] = this.#actor.get_transformed_position();
        [result.width, result.height] = this.#actor.get_transformed_size();
        return result;
    }

    /**
     * @param {Clutter.Actor} actor
     */
    constructor(actor) {
        this.#actor = actor;
        const { opacity } = actor;
        this.#actorProps = { opacity };
        this.#actorClone = new Clutter.Clone({
            name: `${this.#actor.name}-DragActor`,
            source: this.#actor,
            reactive: false,
            ...AnimationType.OpacityMin
        });
        Shell.util_set_hidden_from_pick(this.#actorClone, true);
        Context.desktop.addOverlay(this.#actorClone);
    }

    destroy() {
        Context.jobs.removeAll(this);
        this.#actorClone?.remove_all_transitions();
        this.#actorClone?.destroy();
        this.#actorClone = null;
        this.#actor = null;
        this.#actorProps = null;
    }

    show() {
        if (this.#isVisible || !this.#actorProps) return;
        Context.jobs.removeAll(this);
        this.#isVisible = true;
        this.#actor?.set(this.#actorProps);
        this.#actorClone?.set(AnimationType.OpacityMin);
    }

    /**
     * @param {AppButton?} [candidate]
     */
    hide(candidate) {
        if (!this.#isVisible || !this.#actor) return;
        this.#isVisible = false;
        const canAnimate = !!candidate && Context.desktop.animations;
        if (!canAnimate) return this.#actor.set(AnimationType.OpacityMin);
        Context.jobs.replace(this, Delay.Redraw).enqueue(() =>
        this.#animateHide(candidate.iconRect));
    }

    /**
     * @param {Mtk.Rectangle?} hideRect
     */
    #animateHide(hideRect) {
        if (this.#isVisible || !this.#actorProps || !this.#actorClone) return;
        const actorRect = this.#actorRect;
        if (!actorRect || !hideRect) return this.#actor?.set(AnimationType.OpacityMin);
        this.#actorClone.set({ ...actorRect, ...this.#actorProps });
        this.#actor?.set(AnimationType.OpacityMin);
        const { x, y, width, height } = hideRect;
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const animationParams = { x, y, width, height, mode, ...AnimationType.OpacityMin };
        Animation(this.#actorClone, AnimationDuration.Default, animationParams);
    }

}

export class DragAndDropHandler {

    /** @type {DropCompetitor[]?} */
    #slots = [];

    /** @type {Component?} */
    #parent = null;

    /** @type {AppButton?} */
    #candidate = null;

    /** @type {number} */
    #candidatePosition = -1;

    /** @type {boolean} */
    #isXdndTarget = false;

    /** @type {DragActor?} */
    #dragActor = null;

    /** @type {(() => void)?} */
    #destroyCallback = null;

    /** @type {Mtk.Rectangle} */
    get #parentRect() {
        const rect = this.#parent?.rect;
        if (!this.#parent || !rect) return new Mtk.Rectangle();
        const [x, y] = this.#parent.actor.get_transformed_position();
        [rect.x, rect.y] = [rect.x - x, rect.y - y];
        return rect;
    }

    /** @type {Mtk.Rectangle?} */
    get #dragTargetRect() {
        if (!this.#isXdndTarget) return this.#dragActor?.rect ?? null;
        const [x, y] = global.get_pointer();
        return new Mtk.Rectangle({ x, y, width: 1, height: 1 });
    }

    /** @type {boolean} */
    get hasCandidate() {
        return !!this.#candidate;
    }

    /**
     * @param {Component} parent
     * @param {Component[]} competitors
     * @param {() => void} destroyCallback
     */
    constructor(parent, competitors, destroyCallback) {
        if (!parent || !competitors || !this.#slots) return;
        this.#parent = parent;
        this.#destroyCallback = destroyCallback;
        let slot = null;
        for (const competitor of competitors) {
            if (!competitor.isValid) continue;
            const offset = slot ? slot.rect.x + slot.rect.width : 0;
            slot = DropCompetitor(competitor, offset);
            this.#slots.push(slot);
        }
    }

    abort() {
        this.#dragActor?.show();
        this.destroy();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#releaseCandidate();
        this.#dragActor?.destroy();
        this.#dragActor = null;
        this.#slots = null;
        this.#parent = null;
        if (typeof this.#destroyCallback === 'function') this.#destroyCallback();
        this.#destroyCallback = null;
    }

    /**
     * @param {{x: number, y: number, target: *, actor: Clutter.Actor}} params
     * @returns {Component?}
     */
    handleDrag(params) {
        if (!params || !this.#slots || !this.#parent) return null;
        const { target, actor } = params;
        this.#watchDragTarget(target, actor);
        const x = this.#parentRect.x + params.x;
        const slots = [];
        for (let i = 0, l = this.#slots.length; i < l; ++i) {
            if (!this.#slots[i].competitor?.isValid) continue;
            slots.push(this.#slots[i]);
        }
        this.#slots = slots;
        let slotRect = null;
        let position = this.#slots.length;
        if (this.#candidatePosition > position) {
            this.#candidatePosition = position;
        }
        for (let i = 0, l = position; i < l; ++i) {
            const rect = this.#slots[i].rect;
            if (x < rect.x || x > rect.x + rect.width) continue;
            position = i;
            slotRect = rect;
            break;
        }
        const competitorAtPosition = this.#slots[position]?.competitor;
        if (this.#isXdndTarget) {
            if (competitorAtPosition === this.#candidate) return this.#candidate;
            this.#releaseCandidate();
            this.#candidate = competitorAtPosition instanceof AppButton ?
                              competitorAtPosition : null;
            if (this.#candidate) this.#changeXdndCandidateState(true);
            return competitorAtPosition;
        }
        const competitorBeforePosition = this.#slots[position - 1]?.competitor;
        const lastSlotPosition = this.#slots.length - 1;
        if (target === competitorBeforePosition && position === lastSlotPosition) {
            position++;
            slotRect = null;
        } else if (target === competitorAtPosition || target === competitorBeforePosition) {
            this.#dragActor?.show();
            this.#releaseCandidate();
            return competitorAtPosition;
        }
        if (this.#candidate && (this.#candidatePosition === position ||
                                competitorAtPosition === this.#candidate ||
                                competitorBeforePosition === this.#candidate)) {
            this.#candidatePosition = position;
            return competitorAtPosition;
        }
        this.#releaseCandidate();
        this.#candidatePosition = position;
        this.#candidate = new AppButton(target.app, true).setParent(this.#parent, position);
        this.#dragActor?.hide(this.#candidate);
        if (slotRect) this.#slots.splice(position, 0, DropCompetitor(this.#candidate, slotRect.x));
        return competitorAtPosition;
    }

    /**
     * @returns {[candidate: AppButton, slots: Component[]]?}
     */
    handleDrop() {
        if (!this.#slots || !this.#candidate || this.#isXdndTarget) return null;
        const candidate = this.#candidate;
        const slots = new Set();
        for (let i = 0, l = this.#slots.length; i < l; ++i) {
            const { competitor } = this.#slots[i];
            if (competitor.isValid) slots.add(competitor);
        }
        if (!slots.has(candidate)) slots.add(candidate);
        this.#candidate = null;
        return [candidate, [...slots]];
    }

    /**
     * @param {*} target
     * @param {Clutter.Actor} actor
     */
    #watchDragTarget(target, actor) {
        if (target === XdndHandler) {
            if (this.#isXdndTarget) return;
            this.#isXdndTarget = true;
            Context.signals.add(this, [global.backend.get_dnd(),
                Event.DndLeave, () => this.destroy(),
                Event.DndPositionChange, () => this.#handleDragTargetPosition()]);
            return;
        }
        if (this.#dragActor) return;
        this.#dragActor = new DragActor(actor);
        Context.signals.add(this, [target, Event.Destroy, () => this.destroy()],
                                  [actor, Event.Destroy, () => this.destroy(),
                                          Event.MoveX, () => this.#handleDragTargetPosition(),
                                          Event.MoveY, () => this.#handleDragTargetPosition()]);
    }

    #handleDragTargetPosition() {
        if (!this.#dragActor && !this.#isXdndTarget) return;
        const parentRect = this.#parent?.rect;
        const targetRect = this.#dragTargetRect;
        if (!parentRect || !targetRect) return;
        if (targetRect.overlap(parentRect)) return;
        this.#dragActor?.show();
        this.#releaseCandidate();
    }

    #releaseCandidate() {
        if (!this.#isXdndTarget) this.#candidate?.destroy();
        else this.#changeXdndCandidateState();
        this.#candidate = null;
    }

    /**
     * @param {boolean} [state]
     */
    #changeXdndCandidateState(state = false) {
        Context.jobs.removeAll(this);
        if (!this.#candidate || !this.#isXdndTarget) return;
        const { display, hasHover } = this.#candidate;
        if (state) {
            display.add_style_pseudo_class(PseudoClass.Hover);
            Context.jobs.new(this, Delay.Background).destroy(() => this.#triggerXdndAction());
            return;
        }
        if (!hasHover) display.remove_style_pseudo_class(PseudoClass.Hover);
    }

    #triggerXdndAction() {
        if (!this.#isXdndTarget ||
            !this.#candidate ||
            !this.#candidate.isValid) return;
        this.#candidate.activate();
    }

}
