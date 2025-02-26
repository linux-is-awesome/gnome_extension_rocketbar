/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 */

import { activateWindow as FocusedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import Context from '../../core/context.js';
import { Event } from '../../../shared/core/enums.js';

/**
 * @param {string?} [title]
 * @param {string?} [appName]
 * @returns {string?}
 */
const WindowTitle = (title = null, appName) => {
    if (!title || !appName) return title || null;
    const endRegExp = new RegExp(` [-—](?=[^-]*$).*${appName}$`);
    if (endRegExp.test(title)) {
        return title.replace(endRegExp, '') || title;
    }
    return title.replace(new RegExp(`^${appName} - `), '') || title;
};

export class WindowProxy {

    /** @type {Meta.Window?} */
    #window = null;

    /** @type {string?} */
    #appName = null;

    /** @type {Meta.Window?} */
    get source() {
        return this.#window;
    }

    /** @type {string?} */
    get title() {
        if (!this.#window) return this.#appName;
        return WindowTitle(this.#window.get_title(), this.#appName);
    }

    /**
     * @param {Meta.Window} window
     * @param {string?} [appName]
     */
    constructor(window, appName = null) {
        this.#window = window;
        this.#appName = appName;
        Context.signals.add(this, [this.#window, Event.Unmanaged, () => this.destroy()]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#window = null;
    }

    /**
     * @param {string} event
     * @param {(...args) => *} callback
     */
    connect(event, callback) {
        if (!this.#window) return;
        Context.signals.add(this, [this.#window, event, callback]);
    }

    activate() {
        if (!this.#window) return;
        FocusedWindow(this.#window);
    }

}
