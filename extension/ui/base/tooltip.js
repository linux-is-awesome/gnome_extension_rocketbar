/**
 * JSDoc types
 *
 * @typedef {import('../../core/context/jobs.js').Jobs.Job} Job
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../core/context.js';
import { Component, ComponentLocation } from './component.js';
import { Event, Delay } from '../../core/enums.js';
import { Animation, AnimationType, AnimationDuration } from './animation.js';

const STYLE_CLASS = 'rocketbar__tooltip';
const LAYOUT_STYLE_CLASS = 'dash-label';
const OFFSET_THEME_NODE = 'padding';
const DEFAULT_SHOW_DELAY = Delay.Scheduled;
const DEFAULT_HIDE_DELAY = Delay.Queue;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    style_class: STYLE_CLASS,
    ...AnimationType.OpacityMin,
    ...AnimationType.TranslationReset
};

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    x_expand: true,
    y_expand: true,
    reactive: false,
    track_hover: false,
    style_class: LAYOUT_STYLE_CLASS
};

/**
 * @augments Component<St.Widget>
 */
export class Tooltip extends Component {

    /** @type {Tooltip?} */
    static #shownTooltip = null;

    /** @type {Component<St.Widget>?} */
    #sourceActor = null;

    /** @type {St.Widget?} */
    #layout = null;

    /** @type {[width: number, height: number]?} */
    #targetSize = null;

    /** @type {number?} */
    #offset = null;

    /** @type {ComponentLocation} */
    #location = ComponentLocation.Top;

    /** @type {Job?} */
    #fadeInJob = null;

    /** @type {Job?} */
    #job = Context.jobs.new(super.actor);

    /** @type {{x: number, y: number, width: number, height: number}} */
    get #rect() {
        const actor = super.actor;
        const [x, y, width, height] = [actor.x, actor.y, actor.width, actor.height];
        return { x, y, width, height };
    }

    /** @type {{[param: string]: number}} */
    get #fadeParams() {
        const offset = this.#offset ?? 0;
        const translation_y = offset * (this.#location === ComponentLocation.Top ? -1 : 1);
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        return { translation_y, mode };
    }

    /**
     * @override
     * @type {St.Widget}
     */
    get actor() {
        if (!this.#layout) throw new Error(`${this.constructor.name} is not valid.`);
        return this.#layout;
    }

    /** @param {boolean} value */
    set trackHover(value) {
        if (typeof value !== 'boolean' || !this.#layout) return;
        this.#layout.set({ track_hover: value });
    }

    /**
     * @param {Component<St.Widget>} sourceActor
     * @param {string?} [name]
     */
    constructor(sourceActor, name = null) {
        super(new St.Widget({ name, ...DefaultProps, layout_manager: new Clutter.BinLayout() }));
        this.#layout = new St.Widget({ ...LayoutProps, layout_manager: new Clutter.BinLayout() });
        super.actor.add_child(this.#layout);
        this.#sourceActor = sourceActor;
        this.connect(Event.Destroy, () => this.#destroy());
        this.connect(Event.Mapped, () => this.#job?.reset(Delay.Redraw).queue(() => this.#fadeIn()));
        this.#layout.connect(Event.Hover, () => this.#hover());
        if (typeof name !== 'string') return;
        this.#layout.set({ name: `${name}-Layout` });
    }

    show() {
        if (!this.#job || !this.isValid) return;
        if (Tooltip.#shownTooltip && Tooltip.#shownTooltip !== this) Tooltip.#shownTooltip.hide();
        const delay = Tooltip.#shownTooltip ? DEFAULT_HIDE_DELAY : DEFAULT_SHOW_DELAY;
        this.#fadeInJob = this.#job.reset(delay);
        this.#fadeInJob.queue(() => this.isMapped ? this.#fadeIn() : Context.layout.addOverlay(super.actor));
    }

    /**
     * @param {boolean} [preventHover]
     */
    hide(preventHover = false) {
        if (!this.isValid) return;
        this.#fadeInJob = null;
        this.#job?.reset(DEFAULT_HIDE_DELAY);
        if (!this.isMapped) return;
        if (preventHover) this.#layout?.set({ reactive: false });
        this.#job?.queue(() => this.#fadeOut());
    }

    rerender() {
        if (!this.#sourceActor || !this.isValid) return;
        this.#offset ??= (super.actor.get_theme_node().get_length(OFFSET_THEME_NODE) ?? 0) * 2;
        this.#location = this.#sourceActor.location;
        this.#moveAndResize();
    }

    #destroy() {
        this.#job?.destroy();
        this.#job = null;
        this.#fadeInJob = null;
        this.#layout = null;
        this.#sourceActor = null;
        if (Tooltip.#shownTooltip !== this) return;
        Tooltip.#shownTooltip = null;
    }

    #hover() {
        if (this.#layout?.hover) this.show();
        else this.#job?.reset(DEFAULT_HIDE_DELAY).queue(() => this.hide(true));
    }

    #fadeIn() {
        if (!this.isMapped) return;
        this.rerender();
        const animationParams = { ...AnimationType.OpacityMax, ...AnimationType.TranslationReset };
        if (Tooltip.#shownTooltip && Tooltip.#shownTooltip !== this) {
            Tooltip.#shownTooltip.#remove();
            this.setProps(animationParams);
        } else {
            const actor = super.actor;
            const { translation_y, mode } = this.#fadeParams;
            if (actor.opacity === AnimationType.OpacityMin.opacity) this.setProps({ translation_y });
            Animation(actor, AnimationDuration.Slower, { ...animationParams, mode });
        }
        Tooltip.#shownTooltip = this;
        this.#fadeInJob = null;
        const reactive = this.#layout?.track_hover ?? false;
        if (!reactive) return;
        this.#job?.reset(Delay.Redraw).queue(() => this.#layout?.set({ reactive }));
    }

    async #fadeOut() {
        if (!this.isMapped) return;
        this.#job?.reset();
        const { translation_y, mode } = this.#fadeParams;
        const animationParams = { ...AnimationType.OpacityMin, translation_y, mode };
        const isHidden = await Animation(super.actor, AnimationDuration.Slower, animationParams);
        if (!isHidden || this.#fadeInJob) return;
        this.#remove();
    }

    #remove() {
        if (!this.isMapped) return;
        const actor = super.actor;
        actor.remove_all_transitions();
        this.#layout?.set({ reactive: false });
        this.setProps({ ...AnimationType.OpacityMin, ...AnimationType.TranslationReset }).setSize();
        this.#job?.reset(Delay.Redraw)
                  .queue(() => this.#fadeInJob ? this.show() : Context.layout.removeOverlay(actor));
        this.#targetSize = null;
        if (Tooltip.#shownTooltip !== this) return;
        Tooltip.#shownTooltip = null;
    }

    // TODO: appButton rect is not the center of the app button!!
    async #moveAndResize() {
        if (!this.#sourceActor || !this.isMapped) return;
        const actor = super.actor;
        const sourceActorRect = this.#sourceActor.rect;
        const monitorRect = this.#sourceActor.monitorRect;
        if (!sourceActorRect || !monitorRect) return;
        let [width, height] = this.#targetSize ?? actor.get_size();
        const offset = this.#offset ?? 0;
        const maxWidth = monitorRect.width - offset;
        width = Math.min(maxWidth, width);
        const style = `max-width: ${maxWidth}px;`;
        const sourceCenter = Math.floor((sourceActorRect.width - width) / 2);
        let x = Math.max(monitorRect.x, sourceActorRect.x + sourceCenter);
        const xOverflow = monitorRect.width - (x + width);
        if (x > monitorRect.x && xOverflow < 0) {
            x = Math.max(monitorRect.x, x + xOverflow);
        }
        const y = this.#location === ComponentLocation.Top ?
                  sourceActorRect.y + sourceActorRect.height :
                  sourceActorRect.y - height;
        const targetRect = { x, y, width, height };
        const initialRect = Tooltip.#shownTooltip?.isMapped ? Tooltip.#shownTooltip.#rect : targetRect;
        const heightDiff = initialRect.height > height ? height / initialRect.height :
                                                         initialRect.height / height;
        if (heightDiff < 0.5) {
            initialRect.height = height;
        }
        this.setProps({ ...initialRect, style });
        if (x !== initialRect.x ||
            y !== initialRect.y) Animation(actor, AnimationDuration.Crawl, { x, y });
        if (width !== initialRect.width || height !== initialRect.height) {
            this.#targetSize = [width, height];
            if (!await Animation(actor, AnimationDuration.Slower, { width, height })) return;
        }
        this.setSize();
        this.#targetSize = null;
    }

}
