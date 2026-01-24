import Clutter from 'gi://Clutter';
import Context from '../../core/context.js';

const DEFAULT_LONG_PRESS_DELAY = 600;

export class ActorPressHandler {

    /** @type {number} */
    #longPressDelay = DEFAULT_LONG_PRESS_DELAY;

    /** @type {{event: Clutter.Event, target: Clutter.Actor}?} */
    #pressDetails = null;

    /** @type {((event: Clutter.Event, target: Clutter.Actor) => void)?} */
    #longPressCallback = null;

    /** @type {Clutter.Actor?} */
    #target = null;

    /** @param {number} value */
    set longPressDelay(value) {
        if (typeof value !== 'number') return;
        this.#longPressDelay = value;
    }

    /**
     * @param {((event: Clutter.Event, target: Clutter.Actor) => void)?} [longPressCallback]
     * @param {Clutter.Actor?} [target]
     */
    constructor(longPressCallback = null, target = null) {
        this.#longPressCallback = typeof longPressCallback === 'function' ? longPressCallback : null;
        this.#target = target instanceof Clutter.Actor ? target : null;
    }

    destroy() {
        Context.jobs.removeAll(this);
        this.#pressDetails = null;
        this.#longPressCallback = null;
        this.#target = null;
    }

    /**
     * @param {Clutter.Event} event
     * @param {(button: number, target: Clutter.Actor) => boolean} [callback]
     * @returns {boolean}
     */
    press(event, callback = () => Clutter.EVENT_PROPAGATE) {
        if (event instanceof Clutter.Event === false ||
            event.type() !== Clutter.EventType.BUTTON_PRESS) return Clutter.EVENT_PROPAGATE;
        Context.jobs.removeAll(this);
        this.#pressDetails = null;
        const target = Context.desktop.pointerTarget;
        if (!target || (this.#target && this.#target !== target)) return Clutter.EVENT_PROPAGATE;
        this.#pressDetails = { event, target };
        const hasLongPressCallback = typeof this.#longPressCallback === 'function';
        if (hasLongPressCallback) Context.jobs.new(this, this.#longPressDelay).destroy(() => this.#longPress());
        return callback(event.get_button(), target);
    }

    /**
     * @param {((event: Clutter.Event, target: Clutter.Actor) => void)?} [callback]
     * @returns {boolean}
     */
    release(callback = null) {
        if (!this.#pressDetails) return Clutter.EVENT_PROPAGATE;
        const pressDetails = this.#pressDetails;
        Context.jobs.removeAll(this);
        this.#pressDetails = null;
        if (typeof callback !== 'function') return Clutter.EVENT_PROPAGATE;
        const { event, target } = pressDetails;
        const isSameTarget = target === Context.desktop.pointerTarget;
        if (isSameTarget) callback(event, target);
        return Clutter.EVENT_PROPAGATE;
    }

    #longPress() {
        if (!this.#pressDetails || !this.#longPressCallback) return;
        const { event, target } = this.#pressDetails;
        if (target !== Context.desktop.pointerTarget) return;
        this.#longPressCallback(event, target);
    }

}
