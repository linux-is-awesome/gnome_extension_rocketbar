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

    /** @type {St.Widget} */
    #actor = null;

    /** @type {() => void} */
    #callback = null;

    /**
     * @param {St.Widget|Component} actor
     * @param {() => void} callback
     */
    constructor(actor, callback) {
        if (actor instanceof Component) {
            actor = actor.actor;
        }
        if (actor instanceof St.Widget === false || typeof callback !== Type.Function) return;
        this.#actor = actor;
        this.#callback = callback;
        Context.signals.add(this, [
            this.#actor,
            Event.ButtonPress, () => this.#handlePress(),
            Event.ButtonRelease, () => this.#handleRelease(),
            Event.Leave, () => this.#handleRelease()
        ]); 
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.jobs.removeAll(this);
        this.#actor = null;
        this.#callback = null;
    }

    #handlePress() {
        if (typeof this.#callback !== Type.Function) return Clutter.EVENT_PROPAGATE;
        Context.jobs.new(this, this.#delay).destroy(() => this.#handleDelay()).catch();
        return Clutter.EVENT_PROPAGATE;
    }

    #handleDelay() {
        if (this.#actor instanceof St.Button) this.#actor.fake_release();
        this.#callback()
    }

    #handleRelease() {
        Context.jobs.removeAll(this);
        return Clutter.EVENT_PROPAGATE;
    }

}
