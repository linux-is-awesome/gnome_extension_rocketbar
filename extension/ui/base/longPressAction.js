import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Type, Event } from '../../core/enums.js';

const DEFAULT_LONG_PRESS_DELAY = 600;

export class LongPressAction {

    /** @type {number} */
    #delay = DEFAULT_LONG_PRESS_DELAY;

    /** @type {St.Widget} */
    #actor = null;

    /** @type {Clutter.Event} */
    #event = null;

    /** @type {(event: Clutter.Event) => void} */
    #callback = null;

    /**
     * @param {St.Widget|Component} actor
     * @param {(event: Clutter.Event) => void} callback
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
        this.#event = Clutter.get_current_event();
        if (typeof this.#callback !== Type.Function) return Clutter.EVENT_PROPAGATE;
        Context.jobs.new(this, this.#delay).destroy(() => this.#handleDelay()).catch();
        return Clutter.EVENT_PROPAGATE;
    }

    #handleDelay() {
        if (this.#actor instanceof St.Button) this.#actor.fake_release();
        this.#callback(this.#event);
    }

    #handleRelease() {
        this.#event = null;
        Context.jobs.removeAll(this);
        return Clutter.EVENT_PROPAGATE;
    }

}
