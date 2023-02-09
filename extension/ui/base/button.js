/* exported Button */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Property } from '../../core/enums.js';

const DEFAULT_STYLE_CLASS = 'panel-button rocketbar__button';

/** @enum {string} */
const PseudoClass = {
    Focus: 'focus',
    Active: 'active'
};

/** @type {Object.<string, boolean|number|string>} */
const DefaultProps = {
    reactive: true,
    can_focus: true,
    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
    style_class: DEFAULT_STYLE_CLASS
};

/** @enum {string} */
export const ButtonEvent = {
    Click: 'click',
    Focus: 'focus'
};

export class Button extends Component {

    /** @type {St.Widget} */
    #display = this;

    /** @type {boolean} */
    #isActive = false;

    /** @type {St.Widget} */
    get display() {
        return this.#display;
    }

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @param {boolean} value */
    set isActive(value) {
        if (this.#isActive === value) return;
        this.#isActive = value;
        if (this.#isActive) this.#display.add_style_pseudo_class(PseudoClass.Active);
        else this.#display.remove_style_pseudo_class(PseudoClass.Active);
    }

    /**
     * @param {St.Widget} [display]
     * @param {string} [name]
     */
    constructor(display, name = null) {
        super(new St.Button({ name, ...DefaultProps }));
        this.connect(Event.Clicked, () => this.#click());
        this.connect(Event.FocusIn, () => this.#focus());
        this.connect(Event.FocusOut, () => this.#focus());
        this.#setDisplay(display, name);
    }

    /**
     * @param {St.Widget} display
     * @param {string} [name]
     */
    #setDisplay(display, name) {
        if (display instanceof St.Widget === false) return;
        this.#display = display;
        this.#display.set({ style_class: DEFAULT_STYLE_CLASS });
        this.actor.set_style_class_name(null);
        this.actor.bind_property(Property.Hover, this.#display, Property.Hover, GObject.BindingFlags.SYNC_CREATE);
        if (typeof name !== Type.String) return;
        this.#display.set({ name: `${name}.Display` });
    }

    #click() {
        const event = Clutter.get_current_event();
        if (!event) return;
        const button = event.type() === Clutter.EventType.BUTTON_RELEASE ? event.get_button() : null;
        this.notifySelf(ButtonEvent.Click, { event, button });
    }

    #focus() {
        if (this.actor.has_key_focus()) this.#display.add_style_pseudo_class(PseudoClass.Focus);
        else this.#display.remove_style_pseudo_class(PseudoClass.Focus);
        this.notifySelf(ButtonEvent.Focus);
    }

}
