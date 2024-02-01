/**
 * JSDoc types
 *
 * @typedef {import('../../core/context/jobs.js').Jobs.Job} Job
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Event } from '../../core/enums.js';
import { Animation, AnimationType, AnimationDuration } from './animation.js';

const STYLE_CLASS = 'rocketbar__tooltip';
const LAYOUT_STYLE_CLASS = 'dash-label';
const DEFAULT_SHOW_DELAY = 500;
const DEFAULT_HIDE_DELAY = 100;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    style_class: STYLE_CLASS,
    ...AnimationType.OpacityMin
};

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    x_expand: true,
    y_expand: true,
    style_class: LAYOUT_STYLE_CLASS
};

/**
 * @augments Component<St.Bin>
 */
export class Tooltip extends Component {

    /** @type {Tooltip?} */
    static #shownTooltip = null;

    /** @type {Component<St.Widget>?} */
    #sourceActor = null;

    /** @type {St.Widget?} */
    #layout = null;

    /** @type {Job?} */
    #toggleDelay = Context.jobs.new(super.actor);

    /** @type {{x: number, y: number, width: number, height: number}} */
    get #rect() {
        const actor = super.actor;
        const [x, y, width, height] = [actor.x, actor.y, actor.width, actor.height];
        return { x, y, width, height };
    }

    /**
     * @override
     * @type {St.Widget}
     */
    get actor() {
        if (!this.#layout) throw new Error(`${this.constructor.name} is not valid.`);
        return this.#layout;
    }

    /**
     * @param {Component<St.Widget>} sourceActor
     * @param {string?} [name]
     */
    constructor(sourceActor, name = null) {
        super(new St.Bin({ name, ...DefaultProps }));
        this.#layout = new St.Widget({ ...LayoutProps, layout_manager: new Clutter.BinLayout() });
        super.actor.set_child(this.#layout);
        this.#sourceActor = sourceActor;
        this.connect(Event.Destroy, () => this.#destroy());
        this.connect(Event.Mapped, () => this.#fadeIn());
        if (typeof name !== 'string') return;
        this.#layout.set({ name: `${name}-Layout` });
    }

    show() {
        if (this.isMapped) return;
        const delay = Tooltip.#shownTooltip ? DEFAULT_HIDE_DELAY : DEFAULT_SHOW_DELAY;
        this.#toggleDelay?.reset(delay).then(() =>
            Context.layout.addOverlay(super.actor)).catch();
    }

    hide() {
        this.#toggleDelay?.reset(DEFAULT_HIDE_DELAY);
        if (!this.isMapped) return;
        this.#toggleDelay?.then(() => this.#fadeOut()).catch();
    }

    rerender() {
        this.#moveAndResize();
    }

    #destroy() {
        this.#toggleDelay?.destroy();
        this.#toggleDelay = null;
        this.#layout = null;
        this.#sourceActor = null;
        Tooltip.#shownTooltip = null;
    }

    #fadeIn() {
        if (!this.isMapped) return;
        super.actor.remove_all_transitions();
        this.rerender();
        if (Tooltip.#shownTooltip) {
            if (Tooltip.#shownTooltip !== this) Tooltip.#shownTooltip.#fadeOut(false);
            this.setProps(AnimationType.OpacityMax);
        } else {
            Animation(super.actor, AnimationDuration.Slower, AnimationType.OpacityMax);
        }
        Tooltip.#shownTooltip = this;
    }

    /**
     * @param {boolean} [animate]
     */
    async #fadeOut(animate = true) {
        if (!this.isMapped) return;
        this.#toggleDelay?.reset();
        super.actor.remove_all_transitions();
        if (!animate) {
            this.setProps(AnimationType.OpacityMin).setSize();
            Context.layout.removeOverlay(super.actor);
            if (Tooltip.#shownTooltip !== this) return;
            Tooltip.#shownTooltip = null;
            return;
        }
        const isHidden = await Animation(super.actor, AnimationDuration.Slower, AnimationType.OpacityMin);
        if (isHidden) this.#fadeOut(false);
    }

    // TODO: appButton rect is not the center of the app button!!
    // TODO: y based on location
    async #moveAndResize() {
        if (!this.#sourceActor || !this.#layout || !this.isValid) return;
        const actor = super.actor;
        const sourceActorRect = this.#sourceActor.rect;
        const monitorRect = this.#sourceActor.monitorRect;
        if (!sourceActorRect || !monitorRect) return;
        const [layoutWidth] = this.#layout.get_size();
        let [width, height] = actor.get_size();
        const maxWidth = monitorRect.width - (width - layoutWidth);
        width = Math.min(maxWidth, width);
        const style = `max-width: ${maxWidth}px;`;
        const sourceCenter = Math.floor((sourceActorRect.width - width) / 2);
        const y = sourceActorRect.y + sourceActorRect.height;
        let x = Math.max(monitorRect.x, sourceActorRect.x + sourceCenter);
        const xOverflow = monitorRect.width - (x + width);
        if (x > monitorRect.x && xOverflow < 0) {
            x = Math.max(monitorRect.x, x + xOverflow);
        }
        const targetRect = { x, y, width, height };
        const initialRect = Tooltip.#shownTooltip ? Tooltip.#shownTooltip.#rect : targetRect;
        const heightDiff = initialRect.height > height ? height / initialRect.height :
                                                         initialRect.height / height;
        if (heightDiff < 0.5) {
            initialRect.height = height;
        }
        this.setProps({ ...initialRect, style });
        if (x !== initialRect.x ||
            y !== initialRect.y) Animation(actor, AnimationDuration.Crawl, { x, y });
        if (width !== initialRect.width || height !== initialRect.height) {
            if (!await Animation(actor, AnimationDuration.Slower, { width, height })) return;
            this.setSize();
        }
    }

}
