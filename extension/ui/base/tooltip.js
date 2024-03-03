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
const VISIBLE_OPACITY_THRESHOLD = 100;

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

/** @enum {string} */
export const TooltipEvent = {
    StateChanged: 'tooltip::state-changed'
};

/**
 * @augments Component<St.Widget>
 */
export class Tooltip extends Component {

    /** @type {Tooltip?} */
    static #shownTooltip = null;

    /** @type {number} */
    #showDelay = DEFAULT_SHOW_DELAY;

    /** @type {number} */
    #hideDelay = DEFAULT_HIDE_DELAY;

    /** @type {boolean} */
    #isShown = false;

    /** @type {boolean} */
    #isHidden = true;

    /** @type {Component<St.Widget>?} */
    #sourceActor = null;

    /** @type {St.Widget?} */
    #layout = null;

    /** @type {[width: number, height: number]?} */
    #targetSize = null;

    /** @type {{x?: number, y?: number, width?: number, height?: number}} */
    #transformRect = {};

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

    /** @type {boolean} */
    get #isVisible() {
        return this.hasAllocation && super.actor.opacity > VISIBLE_OPACITY_THRESHOLD;
    }

    /**
     * @override
     * @type {St.Widget}
     */
    get actor() {
        if (!this.#layout) throw new Error(`${this.constructor.name} is not valid.`);
        return this.#layout;
    }

    /** @type {boolean} */
    get isShown() {
        return this.#isShown;
    }

    /** @type {boolean} */
    get isHidden() {
        return this.#isHidden;
    }

    /** @param {boolean} value */
    set trackHover(value) {
        if (typeof value !== 'boolean' || !this.#layout) return;
        this.#layout.set({ track_hover: value });
    }

    /** @param {number} value */
    set showDelay(value) {
        if (typeof value !== 'number') return;
        this.#showDelay = Math.max(value, DEFAULT_HIDE_DELAY);
    }

    /** @param {number} value */
    set hideDelay(value) {
        if (typeof value !== 'number') return;
        this.#hideDelay = Math.max(value, DEFAULT_HIDE_DELAY);
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
        this.#isHidden = false;
        const shownTooltip = Tooltip.#shownTooltip;
        if (shownTooltip && shownTooltip !== this) shownTooltip.hide();
        const delay = shownTooltip && shownTooltip.#isVisible ?
                      Math.min(this.#showDelay, this.#hideDelay) : this.#showDelay;
        this.#fadeInJob = this.#job.reset(delay);
        this.#fadeInJob.queue(() => this.hasAllocation ? this.#fadeIn() : Context.layout.addOverlay(super.actor));
    }

    /**
     * @param {boolean} [preventRestore]
     */
    hide(preventRestore = false) {
        if (!this.isValid) return;
        if (preventRestore) this.#layout?.set({ reactive: false });
        if (this.#isHidden && preventRestore) return;
        this.#isHidden = true;
        this.#fadeInJob = null;
        this.#job?.reset(this.#hideDelay);
        if (!this.hasAllocation) return;
        this.#job?.queue(() => this.#fadeOut());
    }

    rerender() {
        if (this.#isHidden || !this.isValid) return;
        if (!this.#isShown) return this.#rerender();
        this.#job?.reset(Delay.Redraw).queue(() => this.#updateTargetSize().#rerender());
    }

    lockSize() {
        if (!this.#isShown) return;
        const [width, height] = super.actor.get_size();
        this.setSize(width, height);
        this.#targetSize = [width, height];
    }

    #destroy() {
        this.#job?.destroy();
        this.#job = null;
        this.#targetSize = null;
        this.#isHidden = true;
        this.#isShown = false;
        this.#fadeInJob = null;
        this.#layout = null;
        this.#sourceActor = null;
        if (Tooltip.#shownTooltip !== this) return;
        Tooltip.#shownTooltip = null;
    }

    #hover() {
        const hasHover = !!this.#layout?.hover;
        if (hasHover && this.#isShown) return this.show();
        if (hasHover && !this.#checkHoverBounds()) {
            if (!this.#isHidden) this.hide();
            return;
        }
        if (hasHover && this.#isVisible) return this.show();
        if (!hasHover) this.#job?.reset(this.#hideDelay).queue(() => {
            this.#isHidden = false;
            this.hide(true);
        });
    }

    /**
     * @returns {boolean}
     */
    #checkHoverBounds() {
        if (!this.#offset || !this.#sourceActor) return true;
        const sourceActorRect = this.#sourceActor.rect;
        if (!sourceActorRect) return true;
        const [_, y] = global.get_pointer();
        const yOffset = this.#offset / 2;
        const yBound = this.#location === ComponentLocation.Top ?
                       sourceActorRect.y + sourceActorRect.height + yOffset :
                       sourceActorRect.y - yOffset;
        return this.#location === ComponentLocation.Top ? y >= yBound : y <= yBound;
    }

    #fadeIn() {
        if (!this.hasAllocation) return;
        this.rerender();
        const shownTooltip = Tooltip.#shownTooltip;
        const targetProps = { ...AnimationType.OpacityMax, ...AnimationType.TranslationReset };
        if (shownTooltip && shownTooltip !== this) {
            shownTooltip.#remove();
            this.setProps(targetProps);
        } else if (!this.#isShown) {
            const actor = super.actor;
            const { translation_y, mode } = this.#fadeParams;
            if (actor.opacity === AnimationType.OpacityMin.opacity) this.setProps({ translation_y });
            const animationParams = { ...targetProps, mode };
            Animation(actor, AnimationDuration.Slower, animationParams);
        }
        Tooltip.#shownTooltip = this;
        this.#fadeInJob = null;
        this.#changeState(true);
    }

    async #fadeOut() {
        if (!this.hasAllocation) return;
        this.#job?.reset();
        this.#changeState();
        const { translation_y, mode } = this.#fadeParams;
        const animationParams = { ...AnimationType.OpacityMin, translation_y, mode };
        const isHidden = await Animation(super.actor, AnimationDuration.Slower, animationParams);
        if (!isHidden || this.#fadeInJob) return;
        this.#remove();
    }

    #remove() {
        if (!this.hasAllocation) return;
        this.#layout?.set({ reactive: false });
        const actor = super.actor;
        const defaultProps = { ...AnimationType.OpacityMin, ...AnimationType.TranslationReset };
        actor.remove_all_transitions();
        this.#transformRect = {};
        this.#job?.reset(Delay.Redraw)
                  .queue(() => this.#fadeInJob ? this.show() : Context.layout.removeOverlay(actor));
        this.setProps(defaultProps).setSize();
        this.#targetSize = null;
        if (Tooltip.#shownTooltip === this) {
            Tooltip.#shownTooltip = null;
        }
        this.#changeState();
    }

    /**
     * @param {boolean} [state]
     */
    #changeState(state = false) {
        const reactive = !!this.#layout?.track_hover;
        if (state && reactive) this.#job?.reset(Delay.Redraw).queue(() => this.#layout?.set({ reactive }));
        if (this.#isShown === state) return;
        this.#isShown = state;
        if (!reactive) return;
        this.#sourceActor?.notifySelf(TooltipEvent.StateChanged);
    }

    #rerender() {
        if (!this.#sourceActor || this.#isHidden) return;
        this.#offset ??= (super.actor.get_theme_node().get_length(OFFSET_THEME_NODE) ?? 0) * 2;
        this.#location = this.#sourceActor.location;
        this.#moveAndResize();
    }

    #moveAndResize() {
        if (!this.#sourceActor || !this.hasAllocation) return;
        const actor = super.actor;
        const sourceActorRect = this.#sourceActor.centerRect;
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
        const shownTooltip = Tooltip.#shownTooltip;
        const initialRect = shownTooltip?.hasAllocation ? shownTooltip.#rect : targetRect;
        const heightDiff = initialRect.height > height ? height / initialRect.height :
                                                         initialRect.height / height;
        if (heightDiff < 0.5) {
            initialRect.height = height;
        }
        this.setProps({ style });
        this.#transform(initialRect, targetRect);
    }

    /**
     * @param {{x: number, y: number, width: number, height: number}} initialRect
     * @param {{x: number, y: number, width: number, height: number}} targetRect
     */
    #transform(initialRect, targetRect) {
        /** @type {{ x?: number, y?: number }} */
        const position = {};
        /** @type {{ width?: number, height?: number }} */
        const size = {};
        const initialProps = {};
        const currentRect = this.#rect;
        for (const prop in currentRect) {
            const initialProp = initialRect[prop];
            if (currentRect[prop] === initialProp) continue;
            initialProps[prop] = initialProp;
        }
        if (initialRect.x !== targetRect.x &&
            this.#transformRect.x !== targetRect.x) {
            position.x = targetRect.x;
        }
        if (initialRect.y !== targetRect.y &&
            this.#transformRect.y !== targetRect.y) {
            position.y = targetRect.y;
        }
        if (initialRect.width !== targetRect.width &&
            this.#transformRect.width !== targetRect.width) {
            size.width = targetRect.width;
        }
        if (initialRect.height !== targetRect.height &&
            this.#transformRect.height !== targetRect.height) {
            size.height = targetRect.height;
        }
        this.setProps(initialProps);
        const transformPosition = !!Object.keys(position).length;
        const transformSize = !!Object.keys(size).length;
        if (!transformPosition && !transformSize) return;
        const actor = super.actor;
        const transformRect = { ...position, ...size };
        this.#transformRect = transformRect;
        if (transformPosition) Animation(actor, AnimationDuration.Crawl, position).then(() => {
            delete transformRect.x;
            delete transformRect.y;
        });
        if (!transformSize) return;
        this.#targetSize = [targetRect.width, targetRect.height];
        Animation(actor, AnimationDuration.Slower, size).then(isFinished => {
            delete transformRect.width;
            delete transformRect.height;
            if (!isFinished) return;
            this.setSize();
            this.#targetSize = null;
        });
    }

    /**
     * @returns {this}
     */
    #updateTargetSize() {
        if (!this.#targetSize) return this;
        const actor = super.actor;
        const [width, height] = actor.get_size();
        this.setSize();
        this.#targetSize = actor.get_size();
        this.setSize(width, height);
        return this;
    }

}
