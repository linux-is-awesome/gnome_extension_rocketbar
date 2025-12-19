/**
 * @typedef {import('../../../shared/utils/settings.js').default} Settings
 */

import Gdk from 'gi://Gdk';
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
        const widget = this.getSwitchRow(settingsKey);
        if (widget.get_active() !== value) widget.set_active(value);
        if (this.#connectedSettings.has(settingsKey)) return;
        widget.connect(Event.Active, () => this.#settings?.set(settingsKey, widget.get_active()));
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
        widget.connect(Event.ValueChanged, () => this.#settings?.set(settingsKey, widget.get_value()));
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
        widget.connect(Event.RgbaChanged, () => this.#settings?.set(settingsKey, widget.get_rgba().to_string()));
        this.#connectedSettings.add(settingsKey);
    }

}
