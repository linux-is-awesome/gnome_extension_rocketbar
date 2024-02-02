/**
 * JSDoc types
 *
 * @typedef {import('../../core/context/jobs.js').Jobs.Job} Job
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Event, Delay } from '../../core/enums.js';
import { Animation, AnimationDuration } from './animation.js';

const FADE_EFFECT_NAME = 'fade';
const SCROLL_SPEED_MAX = AnimationDuration.Slower;
const SCROLL_SPEED_MIN = AnimationDuration.Faster;

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    clip_to_allocation: true,
    reactive: false,
    hscrollbar_policy: St.PolicyType.EXTERNAL,
    vscrollbar_policy: St.PolicyType.NEVER
};

/**
 * @augments Component<St.ScrollView>
 */
export class ScrollView extends Component {

    /** @type {St.BoxLayout?} */
    #layout = null;

    /** @type {St.Adjustment?} */
    #scroll = super.actor?.hscroll?.adjustment;

    /** @type {number} */
    #scrollPosition = 0;

    /** @type {number} */
    #scrollLimit = -1;

    /** @type {Job?} */
    #handleScrollJob = Context.jobs.new(super.actor, Delay.Redraw);

    /**
     * @override
     * @type {St.BoxLayout}
     */
    get actor() {
        if (!this.#layout) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#layout;
    }

    /** @type {St.ScrollView} */
    get area() {
        return super.actor;
    }

    /** @type {number} 0...scrollSize - pageSize */
    get scrollPosition() {
        const scrollValue = this.#scroll?.value ?? 0;
        return Math.max(scrollValue, this.#scrollPosition);
    }

    /** @type {number} */
    get pageSize() {
        return this.#scroll?.pageSize ?? 0;
    }

    /** @type {number} */
    get scrollSize() {
        return this.#scroll?.upper ?? 0;
    }

    /** @param {number} value -1...0...scrollSize - pageSize */
    set scrollLimit(value) {
        if (typeof value !== 'number') return;
        this.#scrollLimit = value;
    }

    /**
     * @param {string?} [name]
     */
    constructor(name = null) {
        super(new St.ScrollView({ name, ...DefaultProps }));
        this.#layout = new St.BoxLayout();
        super.actor.add_actor(this.#layout);
        super.actor.connect(Event.Destroy, () => this.#destroy());
        this.#scroll?.connect(Event.AdjustmentChanged, () => this.#handleScrollJob?.reset().queue(() =>
                                                             this.#handleScrollSize()));
        if (typeof name !== 'string') return;
        this.#layout.set_name(`${name}-Layout`);
    }

    /**
     * @param {Clutter.Actor|Component<St.Widget>} actor
     * @param {boolean} [deceleration]
     * @returns {Promise<boolean>?}
     */
    scrollToActor(actor, deceleration = false) {
        if (!this.isMapped || !this.#scroll) return null;
        if (actor instanceof Component && actor.isValid) {
            actor = actor.actor;
        }
        if (actor instanceof Clutter.Actor === false) return null;
        let { value, pageSize, upper } = this.#scroll;
        if (pageSize >= ~~upper) return null;
        const fadeEffect = super.actor.get_effect(FADE_EFFECT_NAME);
        const allocation = actor.get_allocation_box();
        const { x1, x2 } = allocation;
        const offset = fadeEffect instanceof St.ScrollViewFade ?
                       fadeEffect.fade_margins.left : x2 - x1;
        if (x1 < value + offset) {
            value = Math.max(0, x1 - offset);
        } else if (x2 > value + pageSize - offset) {
            value = Math.min(upper - pageSize, x2 + offset - pageSize);
        }
        return this.scrollToPosition(~~value, deceleration);
    }

    /**
     * @param {number} value positive value 0...scrollSize - pageSize
     * @param {boolean} [deceleration]
     * @returns {Promise<boolean>?}
     */
    scrollToPosition(value = 0, deceleration = false) {
        if (!this.isMapped || !this.#scroll ||
            this.#scrollPosition === value ||
            (this.#scroll.value === value && this.#scrollPosition <= value) ||
            (this.#scrollLimit !== -1 && value > this.#scrollLimit)) return null;
        const { pageSize, upper } = this.#scroll;
        const maxValue = upper - pageSize;
        const valueOffset = Math.abs(this.#scroll.value - value);
        const targetSpeed = deceleration ? SCROLL_SPEED_MAX : SCROLL_SPEED_MIN;
        const currentSpeed = deceleration ? SCROLL_SPEED_MIN + valueOffset : SCROLL_SPEED_MAX - valueOffset;
        const speed = deceleration ? Math.min(targetSpeed, currentSpeed) :
                      value >= maxValue || !value ? targetSpeed : Math.max(targetSpeed, currentSpeed);
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        this.#scrollPosition = value;
        return Animation(this.#scroll, speed, { value, mode });
    }

    #destroy() {
        this.#handleScrollJob?.destroy();
        this.#handleScrollJob = null;
        this.#layout = null;
        this.#scroll = null;
    }

    /**
     * Note: Calling update_fade_effect to remove fade effect from the scroll view.
     *       It's not implemented in C++ code for some reason.
     */
    #handleScrollSize() {
        if (!this.isValid || !this.#scroll) return;
        const area = super.actor;
        const className = `h${FADE_EFFECT_NAME}`;
        const { pageSize, upper } = this.#scroll;
        if (pageSize < ~~upper) return area.add_style_class_name(className);
        if (!area.has_style_class_name(className)) return;
        area.remove_style_class_name(className);
        area.update_fade_effect(new Clutter.Margin());
    }

}
