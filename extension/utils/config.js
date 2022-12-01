/* exported Config */

var Config = class {

    constructor(callback = () => null) {
        this._callback = callback;
        this._old = null;
        this.values = null; // { field => value }
        this.update();
    }

    update() {

        if (!this._callback) {
            return;
        }

        this._old = this.values;
        this.values = this._callback();
    }

    hasOld() {
        return !!this._old;
    }

    handleChanged(fields = [], callback = () => {}) {

        if (!this._old) {
            callback();
            return;
        }

        if (!this.values) {
            return;
        }

        for (let field of fields) {
            if (this._old[field] !== this.values[field]) {
                callback();
                return;
            }
        }
    }

}