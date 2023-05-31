/* exported ScrollView */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { AnimationDuration } from './animation.js';

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

    /** @type {St.BoxLayout} */
    get actor() {
        return this.#layout;
    }

    /** @type {St.ScrollView} */
    get area() {
        return super.actor;
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
        super.actor.add_actor(this.#layout);
        this.#layout.connect(Event.Destroy, () => { this.#layout = null; });
        if (typeof name !== Type.String) return;
        this.#layout.set_name(`${name}-Layout`);
    }

    /**
     * @param {Component|St.Widget} actor
     */
    scrollTo(actor) {
        if (!this.isMapped) return;
        if (actor instanceof Component) {
            actor = actor.actor;
        }
        if (actor instanceof St.Widget === false) return;
        const scrollView = super.actor;
        const adjustment = scrollView?.hscroll?.adjustment;
        if (!adjustment) return;
        const hfade = scrollView.get_effect(FADE_EFFECT_NAME);
        const offset = hfade?.fade_margins.left ?? 0;
        let box = actor.get_allocation_box();
        let { x1, x2 } = box;
        box = this.#layout.get_allocation_box();
        x1 += box.x1;
        x2 += box.x1;
        let [value, _, upper, __, ___, pageSize] = adjustment.get_values();
        if (x1 < value + offset) {
            value = Math.max(0, x1 - offset);
        } else if (x2 > value + pageSize - offset) {
            value = Math.min(upper, x2 + offset - pageSize);
        } else return;
        adjustment.ease(value, { mode: Clutter.AnimationMode.EASE_OUT_QUAD, duration: AnimationDuration.Fast });
    }

}
