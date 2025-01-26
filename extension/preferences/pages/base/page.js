/**
 * @typedef {import('../../core/context.js').PreferencesWindow} PreferencesWindow
 */

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Context from '../../core/context.js';

const UI_PATH = '/preferences/pages/ui/';
const UI_FILE_TYPE = '.ui';

export default class Page {

    /** @type {Adw.PreferencesPage?} */
    #instance = null;

    /** @type {Gtk.Builder} */
    #template = new Gtk.Builder();

    /**
     * @param {string} name
     */
    constructor(name) {
        this.#template.add_from_file(`${Context.path}${UI_PATH}${name}${UI_FILE_TYPE}`);
        const instance = this.#template.get_object(name);
        if (instance instanceof Adw.PreferencesPage === false) return;
        this.#instance = instance;
    }

    /**
     * @param {PreferencesWindow} window
     */
    setParent(window) {
        if (!window || !this.#instance) return;
        window.add(this.#instance);
    }

    /**
     * @param {string} id
     * @returns {Adw.PreferencesGroup}
     */
    getGroup(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.PreferencesGroup) return result;
        throw new Error(`${id} is not an instane of Adw.PreferencesGroup.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.Picture}
     */
    getPicture(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Picture) return result;
        throw new Error(`${id} is not an instane of Gtk.Picture.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.Label}
     */
    getLabel(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Label) return result;
        throw new Error(`${id} is not an instane of Gtk.Label.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.LinkButton}
     */
    getLinkButton(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.LinkButton) return result;
        throw new Error(`${id} is not an instane of Gtk.LinkButton.`);
    }

}
