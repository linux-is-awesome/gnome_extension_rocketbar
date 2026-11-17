
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Context from '../../core/context.js';
import { MetadataField } from '../../../shared/enums/general.js';

const UI_PATH = '/preferences/ui/';
const UI_FILE_TYPE = '.ui';

export default class PageTemplate {

    /** @type {string} */
    #name;

    /** @type {Gtk.Builder} */
    #template = new Gtk.Builder();

    /**
     * @param {string} name
     */
    constructor(name) {
        const metadata = Context.metadata ?? {};
        const translationDomain = metadata[MetadataField.GettextDomain] ?? null;
        this.#name = name;
        this.#template.set_translation_domain(translationDomain);
        this.#template.add_from_file(`${Context.path}${UI_PATH}${name}${UI_FILE_TYPE}`);
    }

    /**
     * @returns {PageTemplate}
     */
    cloneTemplate() {
        return new PageTemplate(this.#name);
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
     * @returns {Adw.ButtonRow}
     */
    getButtonRow(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.ButtonRow) return result;
        throw new Error(`${id} is not an instane of Adw.ButtonRow.`);
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
     * @returns {Gtk.Stack}
     */
    getStack(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Stack) return result;
        throw new Error(`${id} is not an instane of Gtk.Stack.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.Spinner}
     */
    getSpinner(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Spinner) return result;
        throw new Error(`${id} is not an instane of Gtk.Spinner.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.SearchEntry}
     */
    getSearchEntry(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.SearchEntry) return result;
        throw new Error(`${id} is not an instane of Gtk.SearchEntry.`);
    }

    /**
     * @param {string} id
     * @returns {Adw.WindowTitle}
     */
    getTitle(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Adw.WindowTitle) return result;
        throw new Error(`${id} is not an instane of Adw.WindowTitle.`);
    }

    /**
     * @param {string} id
     * @returns {Gtk.Widget}
     */
    getWidget(id) {
        const result = this.#template.get_object(id);
        if (result instanceof Gtk.Widget) return result;
        throw new Error(`${id} is not an instane of Gtk.Widget.`);
    }

}
