/**
 * @typedef {import('gi://St').Widget} St.Widget
 * @typedef {import('../base/component.js').Component<St.Widget>} Component
 * @typedef {{competitor: Component, rect: Mtk.Rectangle}} DropCompetitor
 */

import Clutter from 'gi://Clutter';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import Context from '../../core/context.js';
import { AppButton } from './appButton.js';
import { Animation, AnimationDuration, AnimationType } from '../base/animation.js';
import { Event, Delay } from '../../../shared/core/enums.js';

/**
 * @param {Component} competitor
 * @param {Mtk.Rectangle} [xyRect]
 * @returns {{competitor: Component, rect: Mtk.Rectangle}}
 */
const DropCompetitor = (competitor, xyRect) => {
    const rect = competitor.rect ?? new Mtk.Rectangle();
    if (xyRect) {
        [rect.x, rect.y] = [xyRect.x, xyRect.y];
    } else {
        const allocation = competitor.actor.get_allocation_box();
        [rect.x, rect.y] = [allocation.x1, allocation.y1];
    }
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
        const canAnimate = !!candidate && Context.desktop.settings.enable_animations;
        if (!canAnimate) return this.#actor.set(AnimationType.OpacityMin);
        Context.jobs.removeAll(this).new(this, Delay.Redraw).queue(() =>
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
        if (!parent || !competitors) return;
        this.#parent = parent;
        for (const competitor of competitors) {
            if (!competitor.isValid) continue;
            this.#slots?.push(DropCompetitor(competitor));
        }
        if (typeof destroyCallback !== 'function') return;
        this.#destroyCallback = destroyCallback;
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#dragActor?.destroy();
        this.#candidate?.destroy();
        this.#dragActor = null;
        this.#candidate = null;
        this.#slots = null;
        this.#parent = null;
        if (typeof this.#destroyCallback === 'function') this.#destroyCallback();
        this.#destroyCallback = null;
    }

    /**
     * @param {{x: number, y: number, target: *, actor: Clutter.Actor}} params
     * @returns {Component|null}
     */
    handleDrag(params) {
        if (!params || !this.#slots || !this.#parent) return null;
        const { target, actor } = params;
        this.#watchDragActor(actor);
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
        const competitorBeforePosition = this.#slots[position - 1]?.competitor;
        const lastSlotPosition = this.#slots.length - 1;
        if (target === competitorBeforePosition && position === lastSlotPosition) {
            position++;
            slotRect = null;
        } else if (target === competitorAtPosition || target === competitorBeforePosition) {
            this.#dragActor?.show();
            this.#candidate?.destroy();
            this.#candidate = null;
            return competitorAtPosition;
        }
        if (this.#candidate && (this.#candidatePosition === position ||
                                competitorAtPosition === this.#candidate ||
                                competitorBeforePosition === this.#candidate)) {
            this.#candidatePosition = position;
            return competitorAtPosition;
        }
        this.#candidate?.destroy();
        this.#candidatePosition = position;
        this.#candidate = new AppButton(target.app, true).setParent(this.#parent, position);
        this.#dragActor?.hide(this.#candidate);
        if (slotRect) this.#slots.splice(position, 0, DropCompetitor(this.#candidate, slotRect));
        return competitorAtPosition;
    }

    /**
     * @returns {[candidate: AppButton, slots: Component[]]?}
     */
    handleDrop() {
        if (!this.#slots || !this.#candidate) return null;
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
     * @param {Clutter.Actor} actor
     */
    #watchDragActor(actor) {
        if (this.#dragActor) return;
        this.#dragActor = new DragActor(actor);
        Context.signals.add(this, [actor, Event.Destroy, () => this.destroy(),
                                          Event.MoveX, () => this.#handleDragActorPosition(),
                                          Event.MoveY, () => this.#handleDragActorPosition()]);
    }

    #handleDragActorPosition() {
        if (!this.#dragActor) return;
        const parentRect = this.#parent?.rect;
        const targetRect = this.#dragActor.rect;
        if (!parentRect || !targetRect) return;
        const [parentContainsActor] = targetRect.intersect(parentRect);
        if (parentContainsActor) return;
        this.#dragActor.show();
        this.#candidate?.destroy();
        this.#candidate = null;
    }

}
