import SettingsPage from './base/settingsPage.js';
import { Config } from '../../shared/utils/config.js';
import { PreferencesPage } from '../../shared/enums/general.js';
import { SettingsKey } from '../../shared/enums/settings.js';

/** @enum {string} */
const ConfigField = {
    launcherApi: SettingsKey.LauncherApi,
    notificationsLauncherApi: SettingsKey.NotificationsLauncherApi,
    notificationsCountAttentionSources: SettingsKey.NotificationsCountAttentionSources
};

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value));

    constructor() {
        super(PreferencesPage.Misc, () => this.#initialize());
    }

    #initialize() {
        for (const key in ConfigField) {
            const settingsKey = ConfigField[key];
            this.#handleConfig(settingsKey, this.#config[key]);
        }
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     */
    #handleConfig(settingsKey, value) {
        value ??= false;
        switch (settingsKey) {
            case ConfigField.launcherApi:
                this.getSwitchRow(ConfigField.notificationsLauncherApi).set_sensitive(value);
            default:
                this.setBoolean(settingsKey, value);
        }
    }

}
