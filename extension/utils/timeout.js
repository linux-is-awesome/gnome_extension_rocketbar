/* exported Timeout */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

export class Timeout {

    static init() {
        return Timeout.idle(400);
    }

    static default(delay = 0) {
        return new Timeout(GLib.PRIORITY_DEFAULT, delay);
    }

    static idle(delay = 0) {
        return new Timeout(delay ? GLib.PRIORITY_DEFAULT_IDLE : Meta.LaterType.IDLE, delay);
    }

    static low(delay = 0) {
        return new Timeout(GLib.PRIORITY_LOW, delay);
    }

    static redraw() {
        return new Timeout(Meta.LaterType.BEFORE_REDRAW);
    }

    constructor(priority, delay) {
        this._priority = priority;
        this._delay = delay;
        this._id = null;
    }

    run(callback) {

        const handler = () => {

            this._id = null;

            if (callback) {
                callback();
            }

            return GLib.SOURCE_REMOVE;
        };

        const laters = global.compositor?.get_laters();

        this._id = (

            this._priority === Meta.LaterType.BEFORE_REDRAW ||
                this._priority === Meta.LaterType.IDLE ?

            (laters ? laters.add(this._priority, handler) : Meta.later_add(this._priority, handler)) :

            GLib.timeout_add(this._priority, this._delay, handler)
        );

        return this;
    }

    destroy() {

        if (!this._id) {
            return;
        }

        if (this._priority === Meta.LaterType.BEFORE_REDRAW ||
                this._priority === Meta.LaterType.IDLE) {

            const laters = global.compositor?.get_laters();
    
            if (laters) {
                laters.remove(this._id);
            } else {
                Meta.later_remove(this._id);
            }

            return;
        }

        GLib.source_remove(this._id);
    }

}
