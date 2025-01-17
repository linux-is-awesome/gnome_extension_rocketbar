/**
 * @typedef {import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js').ExtensionPreferences} Extension
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import SharedContext from '../../shared/core/context.js';

export default class Context extends SharedContext {

    /** @type {Adw.PreferencesWindow?} */
    #window = null;

    /**
     * @param {Extension} extension
     * @param {Adw.PreferencesWindow} window
     */
    constructor(extension, window) {
        super(extension, () => this.#destroy());
        this.#window = window;
        this.#initialize();
    }

    #destroy() {
        this.#window = null;
        return true;
    }

    #initialize() {

    }

}
