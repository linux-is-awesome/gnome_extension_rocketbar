/* exported ScrollView */

import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Animation, AnimationDuration } from './animation.js';

const FADE_EFFECT_NAME = 'fade';

/** @type {Object.<string, boolean|number>} */
const DefaultProps = {
    clip_to_allocation: true,
    reactive: false,
    hscrollbar_policy: St.PolicyType.EXTERNAL,
    vscrollbar_policy: St.PolicyType.NEVER   
};

export class ScrollView extends Component {

    /** @type {St.BoxLayout} */
    #layout = new St.BoxLayout();

    /** @type {St.Adjustment} */
    #scroll = null;

    /** @type {St.BoxLayout} */
    get actor() {
        return this.#layout;
    }

    /** @type {St.ScrollView} */
    get area() {
        return super.actor;
    }

    /** @type {St.Adjustment} */
    get scroll() {
        if (!this.#scroll) {
            this.#scroll = super.actor?.hscroll?.adjustment
        }
        return this.#scroll;
    }

    /** @param {boolean} value */
    set horizontalFade(value) {
        const className = `h${FADE_EFFECT_NAME}`;
        if (value) super.actor.add_style_class_name(className);
        else super.actor.remove_style_class_name(className);
    }

    /**
     * @param {string} [name] 
     */
    constructor(name = null) {
        super(new St.ScrollView({ name, ...DefaultProps }));
        const area = this.area;
        area.add_actor(this.#layout);
        area.connect(Event.Destroy, () => this.#destroy());
        this.scroll?.connect(Event.AdjustmentChanged, () => this.#handleScrollSize());
        if (typeof name !== Type.String) return;
        this.#layout.set_name(`${name}-Layout`);
    }

    /**
     * @param {Component|St.Widget} actor
     */
    scrollToActor(actor) {
        if (!this.isMapped || !this.scroll) return;
        if (actor instanceof Component && actor.isValid) {
            actor = actor.actor;
        }
        if (actor instanceof St.Widget === false) return;
        let { value, pageSize, upper } = this.#scroll;
        if (pageSize >= upper) return; 
        const fadeEffect = this.area.get_effect(FADE_EFFECT_NAME);
        const allocation = actor.get_allocation_box();
        const { x1, x2 } = allocation;
        const offset = fadeEffect?.fade_margins.left ?? x2 - x1;
        if (x1 < value + offset) {
            value = Math.max(0, x1 - offset);
        } else if (x2 > value + pageSize - offset) {
            value = Math.min(upper - pageSize, x2 + offset - pageSize);
        }
        this.scrollToPosition(value);
    }

    /**
     * @param {number} value
     * @returns {Promise|null}
     */
    scrollToPosition(value = 0) {
        if (!this.isMapped || !this.scroll ||
            this.#scroll.value === value) return null;
        return Animation(this.#scroll, AnimationDuration.Faster, { value });
    }


    #destroy() {
        this.#layout = null;
        this.#scroll = null;
    }

    #handleScrollSize() {
        if (!this.isValid || !this.scroll) return;
        const className = `h${FADE_EFFECT_NAME}`;
        const { pageSize, upper } = this.#scroll;
        if (pageSize >= upper) super.actor.remove_style_class_name(className);
        else super.actor.add_style_class_name(className);
    }

}
