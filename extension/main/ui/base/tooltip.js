/**
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Animation, AnimationType, AnimationDuration } from './animation.js';
import { ActorPressHandler } from './actorPressHandler.js';
import { MaxLengthBounds, MaxLengthCalculator } from '../../utils/maxLengthCalculator.js';
import { Event, Delay, Alignment } from '../../../shared/enums/general.js';

const STYLE_CLASS = 'rocketbar__tooltip';
const BODY_STYLE_CLASS = 'dash-label';
const OFFSET_THEME_NODE = 'padding';
const DEFAULT_SHOW_DELAY = Delay.Scheduled;
const DEFAULT_HIDE_DELAY = Delay.Queue;
const VISIBLE_OPACITY_THRESHOLD = 100;
const HEIGHT_TRANSFORMATION_THRESHOLD = 0.5;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    style_class: STYLE_CLASS,
    ...AnimationType.OpacityMin,
    ...AnimationType.TranslationReset
};

/** @type {{[prop: string]: *}} */
const BodyProps = {
    x_expand: true,
    y_expand: true,
    reactive: true,
    track_hover: false,
    style_class: BODY_STYLE_CLASS
};

/** @enum {string} */
export const TooltipEvent = {
    StateChanged: 'tooltip::state-changed',
    Click: 'tooltip::click',
    LongPress: 'tooltip::long-press'
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
    #isInitialized = false;

    /** @type {boolean} */
    #isShown = false;

    /** @type {boolean} */
    #isHidden = true;

    /** @type {boolean} */
    #isReactive = false;

    /** @type {Component<St.Widget>?} */
    #sourceActor = null;

    /** @type {St.Widget?} */
    #body = null;

    /** @type {[width: number, height: number]?} */
    #targetSize = null;

    /** @type {{x?: number, y?: number, width?: number, height?: number}} */
    #transformRect = {};

    /** @type {number?} */
    #offset = null;

    /** @type {Alignment} */
    #location = Alignment.Top;

    /** @type {number} */
    #maxLength = MaxLengthBounds.Max;

    /** @type {ActorPressHandler?} */
    #pressHandler = null;

    /** @type {Job?} */
    #fadeInJob = null;

    /** @type {Job?} */
    #rerenderJob = Context.jobs.new(this, Delay.Redraw);

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
        const translation_y = offset * (this.#location === Alignment.Top ? -1 : 1);
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
        if (!this.#body) throw new Error(`${this.constructor.name} is not valid.`);
        return this.#body;
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
        if (typeof value !== 'boolean' || !this.#body) return;
        this.#body.set({ track_hover: value });
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

    /** @param {number} value */
    set maxLength(value) {
        if (typeof value !== 'number' || !this.isValid) return;
        this.#maxLength = value;
        super.actor.set_style(null);
    }

    /**
     * @param {Component<St.Widget>} sourceActor
     * @param {string?} [name]
     */
    constructor(sourceActor, name = null) {
        super(new St.Widget({ name, ...DefaultProps, layout_manager: new Clutter.BinLayout() }));
        this.#body = new St.Widget({ ...BodyProps, layout_manager: new Clutter.BinLayout() });
        super.actor.add_child(this.#body);
        this.#sourceActor = sourceActor;
        this.#pressHandler = new ActorPressHandler((...args) => this.#longPress(...args), this.#body);
        const body = new Component(this.#body);
        body.connect(Event.Hover, () => this.#hover());
        body.connect(Event.ButtonPress, (_, event) => this.#pressHandler?.press(event));
        body.connect(Event.ButtonRelease, () => this.#pressHandler?.release((...args) => this.#click(...args)));
        body.connect(Event.Leave, () => this.#pressHandler?.release());
        this.connect(Event.Destroy, () => this.#destroy());
        this.connect(Event.Mapped, () => this.#handleMapped());
        if (typeof name !== 'string') return;
        this.#body.set_name(`${name}-Body`);
    }

    /**
     * @param {boolean} [isInstant]
     */
    show(isInstant = false) {
        if (!this.#job || !this.isValid) return;
        this.#isHidden = false;
        const shownTooltip = Tooltip.#shownTooltip;
        if (shownTooltip && shownTooltip !== this) shownTooltip.hide();
        const showDelay = isInstant ? Delay.Idle : this.#showDelay;
        const delay = shownTooltip && shownTooltip.#isVisible ?
                      Math.min(showDelay, this.#hideDelay) : showDelay;
        this.#fadeInJob = this.#job.reset(delay);
        this.#fadeInJob.enqueue(() =>
            this.hasAllocation ? this.#fadeIn() : Context.desktop.addOverlay(super.actor, true));
    }

    /**
     * @param {boolean} [isFinal]
     */
    hide(isFinal = false) {
        if (!this.isValid) return;
        this.#isReactive = !isFinal;
        if (this.#isHidden && isFinal) return;
        this.#isHidden = true;
        this.#fadeInJob = null;
        this.#job?.reset(this.#hideDelay);
        if (!this.hasAllocation) return;
        this.#job?.enqueue(() => this.#fadeOut());
    }

    rerender() {
        if (this.#isHidden || !this.#rerenderJob || !this.isValid) return;
        this.#rerenderJob.reset();
        if (!this.#isShown) return this.#rerender();
        this.#rerenderJob.enqueue(() => this.#updateTargetSize().#rerender());
    }

    lockSize() {
        if (!this.#isShown) return;
        const [width, height] = super.actor.get_size();
        this.setSize(width, height);
        this.#targetSize = [width, height];
    }

    #destroy() {
        this.#rerenderJob?.destroy();
        this.#job?.destroy();
        this.#pressHandler?.destroy();
        this.#rerenderJob = null;
        this.#job = null;
        this.#pressHandler = null;
        this.#targetSize = null;
        this.#isReactive = false;
        this.#isHidden = true;
        this.#isShown = false;
        this.#fadeInJob = null;
        this.#body = null;
        this.#sourceActor = null;
        if (Tooltip.#shownTooltip !== this) return;
        Tooltip.#shownTooltip = null;
    }

    #handleMapped() {
        this.#isInitialized = false;
        if (this.#isHidden || !this.hasAllocation) return;
        this.#job?.reset(Delay.Redraw).enqueue(() => this.setSize().#fadeIn());
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #click(event, target) {
        if (this.notifySelf(TooltipEvent.Click, { event, target })) return;
        this.hide(true);
    }

    /**
     * @param {Clutter.Event} event
     * @param {Clutter.Actor} target
     */
    #longPress(event, target) {
        if (!this.notifySelf(TooltipEvent.LongPress, { event, target })) return;
        this.#pressHandler?.release();
    }

    #hover() {
        if (!this.#isReactive) return;
        const hasHover = !!this.#body?.hover;
        if (hasHover && this.#isShown) return this.show();
        if (hasHover && !this.#checkHoverBounds()) {
            if (!this.#isHidden) this.hide();
            return;
        }
        if (hasHover && this.#isVisible) return this.show();
        if (!hasHover) this.#job?.reset(this.#hideDelay).enqueue(() => {
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
        const yBound = this.#location === Alignment.Top ?
                       sourceActorRect.y + sourceActorRect.height + yOffset :
                       sourceActorRect.y - yOffset;
        return this.#location === Alignment.Top ? y >= yBound : y <= yBound;
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
        this.#isReactive = false;
        const actor = super.actor;
        const defaultProps = { ...AnimationType.OpacityMin, ...AnimationType.TranslationReset };
        actor.remove_all_transitions();
        this.#transformRect = {};
        this.#job?.reset(Delay.Redraw)
                  .enqueue(() => this.#fadeInJob ? this.show() : Context.desktop.removeOverlay(actor));
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
        const canTrackHover = !!this.#body?.track_hover;
        this.#isReactive = state && canTrackHover;
        if (this.#isShown === state) return;
        this.#isShown = state;
        if (!canTrackHover) return;
        this.#sourceActor?.notifySelf(TooltipEvent.StateChanged);
    }

    #rerender() {
        if (!this.#sourceActor || this.#isHidden) return;
        this.#offset ??= (super.actor.get_theme_node().get_length(OFFSET_THEME_NODE) ?? 0) * 2;
        const [_, y] = Context.monitors.getAlignment(this.#sourceActor.rect);
        this.#location = y;
        this.#moveAndResize();
    }

    #moveAndResize() {
        if (!this.#sourceActor || !this.hasAllocation) return;
        const actor = super.actor;
        const sourceActorRect = this.#sourceActor.rect;
        if (!sourceActorRect) return;
        const monitor = Context.monitors.getMonitorInfo(sourceActorRect);
        const sourceActorCenterRect = this.#sourceActor.centerRect;
        if (!sourceActorCenterRect || !monitor) return;
        let [width, height] = this.#targetSize ?? actor.get_size();
        const offset = this.#offset ?? 0;
        const maxWidth = MaxLengthCalculator(monitor.width - offset, this.#maxLength);
        width = Math.min(maxWidth, width);
        const style = `max-width: ${maxWidth}px;`;
        const sourceCenter = Math.floor((sourceActorCenterRect.width - width) / 2);
        let x = Math.max(monitor.x, sourceActorCenterRect.x + sourceCenter);
        const y = this.#location === Alignment.Top ?
                  sourceActorRect.y + sourceActorRect.height :
                  sourceActorRect.y - height;
        const targetRect = { x, y, width, height };
        const shownTooltip = Tooltip.#shownTooltip;
        const initialRect = shownTooltip?.hasAllocation && shownTooltip.#isInitialized ?
                            shownTooltip.#rect : targetRect;
        const heightDiff = initialRect.height > height ? height / initialRect.height :
                                                         initialRect.height / height;
        if (heightDiff < HEIGHT_TRANSFORMATION_THRESHOLD) {
            initialRect.height = height;
            initialRect.y = y;
        }
        this.setProps({ style });
        this.#transform(initialRect, targetRect);
    }

    /**
     * @param {{x: number, y: number, width: number, height: number}} initialRect
     * @param {{x: number, y: number, width: number, height: number}} targetRect
     */
    #transform(initialRect, targetRect) {
        /** @type {{x?: number, y?: number}} */
        const position = {};
        /** @type {{width?: number, height?: number}} */
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
        this.#isInitialized = true;
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
