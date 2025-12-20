import SettingsPage from './base/settingsPage.js';
import { Config } from '../../shared/utils/config.js';
import { PreferencesPage } from '../../shared/enums/general.js';
import { ConfigOptions, ConfigField } from '../../shared/enums/notificationCounter.js';

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.NotificationCounter, () => this.#initialize(), ConfigOptions.path);
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
        switch (settingsKey) {
            case ConfigField.centerClock:
            case ConfigField.hideEmpty:
                this.setBoolean(settingsKey, value);
                break;
            case ConfigField.fontSize:
            case ConfigField.maxCount:
            case ConfigField.offset:
            case ConfigField.roundness:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.colorEmpty:
            case ConfigField.colorEmptyDnd:
            case ConfigField.colorNotEmpty:
            case ConfigField.colorNotEmptyDnd:
            case ConfigField.textColor:
            case ConfigField.textColorDnd:
                this.setColor(settingsKey, value);
                break;
        }
    }

}
