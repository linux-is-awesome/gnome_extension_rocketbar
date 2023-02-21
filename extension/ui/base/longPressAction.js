/* exported LongPressAction */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Type, Event } from '../../core/enums.js';
import { Component } from './component.js';
import { Context } from '../../core/context.js';

const DEFAULT_LONG_PRESS_DELAY = 600;

export class LongPressAction {

    /** @type {number} */
    #delay = DEFAULT_LONG_PRESS_DELAY;

    /** @type {() => void} */
    #callback = null;

    constructor(actor, callback) {
        if (actor instanceof Component) {
            actor = actor.actor;
        }
        if (actor instanceof St.Widget === false || typeof callback !== Type.Function) return;
        this.#callback = callback;
        Context.signals.add(this, [
            actor,
            Event.ButtonPress, () => this.#handlePress(),
            Event.ButtonRelease, () => this.#handleRelease(),
            Event.Leave, () => this.#handleRelease()
        ]); 
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.jobs.removeAll(this);
        this.#callback = null;
    }

    #handlePress() {
        if (typeof this.#callback !== Type.Function) return Clutter.EVENT_PROPAGATE;
        Context.jobs.new(this, this.#delay).destroy(() => this.#callback()).catch();
        return Clutter.EVENT_PROPAGATE;
    }

    #handleRelease() {
        Context.jobs.removeAll(this);
        return Clutter.EVENT_PROPAGATE;
    }

}
