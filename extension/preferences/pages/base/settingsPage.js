/**
 * @typedef {import('../../../shared/utils/settings.js').default} Settings
 */

import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Page from './page.js';
import Context from '../../core/context.js';
import { Event } from '../../../shared/enums/general.js';

export default class SettingsPage extends Page {

    /** @type {Set<string>} */
    #connectedSettings = new Set();

    /** @type {Settings?} */
    #settings = null;

    /** @type {Settings} */
    get settings() {
        if (!this.#settings) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#settings;
    }

    /**
     * @param {string} name
     * @param {() => void} callback
     * @param {string?} [settingsPath]
     */
    constructor(name, callback, settingsPath = null) {
        super(name, callback);
        this.#settings = Context.getSettings(settingsPath);
    }

    /**
     * @param {string} settingsKey
     * @param {boolean} value
     */
    setBoolean(settingsKey, value) {
        if (!this.#settings) return;
        value ??= false;
        if (typeof value !== 'boolean') return;
        const widget = this.getWidget(settingsKey);
        const isConnected = this.#connectedSettings.has(settingsKey);
        if (widget instanceof Gtk.Switch) {
            if (widget.get_active() !== value) widget.set_active(value);
            const row = this.getWidget(`${settingsKey}-row`);
            const arrow = this.getWidget(`${settingsKey}-row-arrow`);
            if (row instanceof Adw.ActionRow) row.set_activatable(value);
            if (arrow instanceof Gtk.Image) arrow.set_sensitive(value);
            if (isConnected) return;
            widget.connect(Event.ActiveChanged, () =>
            this.settings.set(settingsKey, widget.get_active()));
        } else if (widget instanceof Adw.SwitchRow) {
            if (widget.get_active() !== value) widget.set_active(value);
            if (isConnected) return;
            widget.connect(Event.ActiveChanged, () =>
            this.settings.set(settingsKey, widget.get_active()));
        } else if (widget instanceof Adw.ExpanderRow) {
            if (widget.get_enable_expansion() !== value) widget.set_enable_expansion(value);
            if (isConnected) return;
            widget.connect(Event.EnableExpansionChanged, () =>
            this.settings.set(settingsKey, widget.get_enable_expansion()));
        }
        this.#connectedSettings.add(settingsKey);
    }

    /**
     * @param {string} settingsKey
     * @param {number} value
     */
    setNumber(settingsKey, value) {
        if (!this.#settings) return;
        value ??= 0;
        if (typeof value !== 'number') return;
        const widget = this.getSpinRow(settingsKey);
        if (widget.get_value() !== value) widget.set_value(value);
        if (this.#connectedSettings.has(settingsKey)) return;
        widget.connect(Event.ValueChanged, () =>
        this.#settings?.set(settingsKey, widget.get_value()));
        this.#connectedSettings.add(settingsKey);
    }

    /**
     * @param {string} settingsKey
     * @param {string} value
     */
    setColor(settingsKey, value) {
        if (!this.#settings) return;
        value ??= '';
        if (typeof value !== 'string') return;
        const widget = this.getColorButton(settingsKey);
        if (value && widget.get_rgba().to_string() !== value) {
            const rgba = new Gdk.RGBA();
            rgba.parse(value);
            widget.set_rgba(rgba);
        }
        if (this.#connectedSettings.has(settingsKey)) return;
        widget.connect(Event.RgbaChanged, () =>
        this.#settings?.set(settingsKey, widget.get_rgba().to_string()));
        this.#connectedSettings.add(settingsKey);
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     * @param {*[]} options
     */
    setOption(settingsKey, value, options) {
        if (!this.#settings) return;
        const optionIndex = options.indexOf(value);
        if (optionIndex < 0) return;
        const widget = this.getComboRow(settingsKey);
        if (widget.get_selected() !== optionIndex) widget.set_selected(optionIndex);
        if (this.#connectedSettings.has(settingsKey)) return;
        widget.connect(Event.SelectedItemChanged, () =>
        this.#settings?.set(settingsKey, options[widget.get_selected()]));
        this.#connectedSettings.add(settingsKey);
    }

}
