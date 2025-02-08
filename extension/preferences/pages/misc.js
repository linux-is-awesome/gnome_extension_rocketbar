/**
 * @typedef {import('gi://Gtk').Switch} Gtk.Switch
 */
import Page from './base/page.js';
import Context from '../core/context.js';
import { Config } from '../../shared/utils/config.js';
import { Event, SettingsKey } from '../../shared/core/enums.js';

const PAGE_NAME = 'misc';

/** @enum {string} */
const ConfigField = {
    launcherApi: SettingsKey.LauncherApi,
    notificationsLauncherApi: SettingsKey.NotificationsLauncherApi,
    notificationsCountAttentionSources: SettingsKey.NotificationsCountAttentionSources
};

export default class extends Page {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value));

    constructor() {
        super(PAGE_NAME);
        this.#initialize();
    }

    #initialize() {
        const settings = Context.getSettings();
        if (!settings) return;
        for (const key in ConfigField) {
            const settingsKey = ConfigField[key];
            const widget = this.getSwitch(settingsKey);
            this.#handleConfig(settingsKey, this.#config[key], widget);
            widget.connect(Event.Active, () => settings.set(settingsKey, widget.get_active()));
        }

    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     * @param {Gtk.Switch} [widget]
     */
    #handleConfig(settingsKey, value, widget) {
        value ??= false;
        switch (settingsKey) {
            case ConfigField.launcherApi:
                const rowId = `${ConfigField.notificationsLauncherApi}-row`;
                this.getRow(rowId).set_sensitive(value);
            default:
                widget ??= this.getSwitch(settingsKey);
                if (widget.get_active() === value) return;
                widget.set_active(value);
        }
    }

}
