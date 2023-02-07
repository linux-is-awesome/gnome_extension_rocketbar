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
        this.connect(Event.Clicked, () => this.#clicked());
        if (display instanceof St.Widget === false) return;
        this.#display = display;
        this.actor.bind_property(Property.Hover, this.#display, Property.Hover, GObject.BindingFlags.SYNC_CREATE);
        if (typeof name !== Type.String) return;
        this.#display.set({ name: `${name}.Display` });
    }

    #clicked() {
        const event = Clutter.get_current_event();
        if (!event) return;
        const button = event.type() === Clutter.EventType.BUTTON_RELEASE ? event.get_button() : null;
        this.notifySelf(Event.Clicked, { event, button });
    }

}
