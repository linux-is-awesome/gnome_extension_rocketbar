/**
 * @typedef {import('gi://GObject').Object} GObject.Object
 * @typedef {import('../../core/context.js').PreferencesWindow} PreferencesWindow
 */

import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Context from '../../core/context.js';
import { Event, MetadataField } from '../../../shared/enums/general.js';

const UI_PATH = '/preferences/ui/';
const UI_FILE_TYPE = '.ui';

export default class Page {

    /** @type {Adw.PreferencesPage?} */
    #instance = null;

    /** @type {Adw.NavigationPage?} */
    #wrapper = null;

    /** @type {Gtk.Builder} */
    #template = new Gtk.Builder();

    /** @type {(() => void)?} */
    #callback = null;

    /** @type {boolean} */
    #isInitialized = false;

    /**
     * @param {string} name
     * @param {() => void} callback
     */
    constructor(name, callback) {
        const metadata = Context.metadata ?? {};
        const translationDomain = metadata[MetadataField.GettextDomain] ?? null;
        this.#template.set_translation_domain(translationDomain);
        this.#template.add_from_file(`${Context.path}${UI_PATH}${name}${UI_FILE_TYPE}`);
        let instance = this.#template.get_object(name);
        if (instance instanceof Adw.NavigationPage) {
            this.#wrapper = instance;
            instance = this.#template.get_object(`${name}-page`);
        }
        if (instance instanceof Adw.PreferencesPage === false) return;
        this.#instance = instance;
        this.#callback = callback;
    }

    /**
     * @param {PreferencesWindow} window
     */
    setParent(window) {
        if (!window || !this.#instance || this.#isInitialized || this.#wrapper) return;
        window.connect(Event.VisiblePageChanged, () => this.#initialize(window.get_visible_page()));
        window.add(this.#instance);
    }

    /**
     * @param {PreferencesWindow} window
     */
    show(window) {
        if (!window || !this.#instance) return;
        if (!this.#wrapper) return window.set_visible_page(this.#instance);
        if (!this.#isInitialized) this.#initialize(this.#instance);
        window.push_subpage(this.#wrapper);
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
     * @returns {Adw.ActionRow}
     */
    getActionRow(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.ActionRow) return result;
        throw new Error(`${id} is not an instane of Adw.ActionRow.`);
    }

    /**
     * @param {string} id
     * @returns {Adw.SwitchRow}
     */
    getSwitchRow(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.SwitchRow) return result;
        throw new Error(`${id} is not an instane of Adw.SwitchRow.`);
    }

    /**
     * @param {string} id
     * @returns {Adw.ComboRow}
     */
    getComboRow(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.ComboRow) return result;
        throw new Error(`${id} is not an instane of Adw.ComboRow.`);
    }

    /**
     * @param {string} id
     * @returns {Adw.SpinRow}
     */
    getSpinRow(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.SpinRow) return result;
        throw new Error(`${id} is not an instane of Adw.SpinRow.`);
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
     * @returns {Gtk.Image}
     */
    getImage(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Image) return result;
        throw new Error(`${id} is not an instane of Gtk.Image.`);
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

    /**
     * @param {string} id
     * @returns {Gtk.Switch}
     */
    getSwitch(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Switch) return result;
        throw new Error(`${id} is not an instane of Gtk.Switch.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.ColorDialogButton}
     */
    getColorButton(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.ColorDialogButton) return result;
        throw new Error(`${id} is not an instane of Gtk.ColorDialogButton.`);
    }

    /**
     * @param {string} id
     * @returns {GObject.Object?}
     */
    getObject(id) {
        return this.#template.get_object(id);
    }

    /**
     * @param {Adw.PreferencesPage?} visiblePage
     */
    #initialize(visiblePage) {
        if (visiblePage !== this.#instance) return;
        if (this.#isInitialized) return;
        this.#isInitialized = true;
        if (typeof this.#callback === 'function') this.#callback();
    }

}
