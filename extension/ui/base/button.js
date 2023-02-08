/* exported Button */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Property } from '../../core/enums.js';

/** @type {Object.<string, boolean|number>} */
const DefaultProps = {
    reactive: true,
    can_focus: true,
    button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE
};

/** @enum {string} */
export const ButtonEvent = {
    Click: 'click',
    Focus: 'focus'
};

export class Button extends Component {

    /** @type {St.Widget} */
    #display = this;

    /** @type {St.Widget} */
    get display() {
        return this.#display;
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
        if (display instanceof St.Widget === false) return;
        this.#display = display;
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
        if (this.actor.has_key_focus()) this.#display.add_style_pseudo_class('focus');
        else this.#display.remove_style_pseudo_class('focus');
        this.notifySelf(ButtonEvent.Focus);
    }

}
