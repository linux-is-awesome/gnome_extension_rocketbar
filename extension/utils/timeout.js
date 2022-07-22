/* exported Timeout */

const { GLib, Meta } = imports.gi;

var Timeout = class {

    static default(delay = 0) {
        return new Timeout(GLib.PRIORITY_DEFAULT, delay);
    }

    static idle(delay = 0) {
        return new Timeout(GLib.PRIORITY_DEFAULT_IDLE, delay);
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

        this._id = (

            this._priority === Meta.LaterType.BEFORE_REDRAW ?

            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, handler) :

            GLib.timeout_add(this._priority, this._delay, handler)
        );

        return this;
    }

    destroy() {

        if (!this._id) {
            return;
        }

        if (this._priority === Meta.LaterType.BEFORE_REDRAW) {
            Meta.later_remove(this._id);
            return;
        }

        GLib.source_remove(this._id);
    }

}