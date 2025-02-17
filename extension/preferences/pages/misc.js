/**
 * @typedef {import('gi://Adw').SwitchRow} Adw.SwitchRow
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
        super(PAGE_NAME, () => this.#initialize());
    }

    #initialize() {
        const settings = Context.getSettings();
        if (!settings) return;
        for (const key in ConfigField) {
            const settingsKey = ConfigField[key];
            const widget = this.getSwitchRow(settingsKey);
            this.#handleConfig(settingsKey, this.#config[key], widget);
            widget.connect(Event.Active, () => settings.set(settingsKey, widget.get_active()));
        }
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     * @param {Adw.SwitchRow} [widget]
     */
    #handleConfig(settingsKey, value, widget) {
        value ??= false;
        switch (settingsKey) {
            case ConfigField.launcherApi:
                this.getSwitchRow(ConfigField.notificationsLauncherApi).set_sensitive(value);
            default:
                widget ??= this.getSwitchRow(settingsKey);
                if (widget.get_active() === value) return;
                widget.set_active(value);
        }
    }

}
