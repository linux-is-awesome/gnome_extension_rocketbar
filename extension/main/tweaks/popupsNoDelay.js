import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';

export default class {

    /** @type {((...args) => boolean)?} */
    #backup = null;

    constructor() {
        const originFunction = SwitcherPopup.prototype.show;
        SwitcherPopup.prototype.show = function (...args) {
            const result = originFunction.call(this, ...args);
            if (result) this._showImmediately();
            return result;
        };
        this.#backup = originFunction;
    }

    destroy() {
        if (typeof this.#backup !== 'function') return;
        SwitcherPopup.prototype.show = this.#backup;
        this.#backup = null;
    }

}
