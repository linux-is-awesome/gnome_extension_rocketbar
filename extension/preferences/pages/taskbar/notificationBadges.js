import SettingsPage from '../base/settingsPage.js';
import { Config } from '../../../shared/utils/config.js';
import { PreferencesPage, Alignment } from '../../../shared/enums/general.js';
import { ConfigOptions,
         NotificationBadgeConfigField as ConfigField } from '../../../shared/enums/taskbar.js';

const POSITION_OPTIONS = [
    Alignment.TopLeft,
    Alignment.TopRight,
    Alignment.BottomLeft,
    Alignment.BottomRight
];

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.TaskbarNotificationBadges, () => this.#initialize(), ConfigOptions.path);
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
            case ConfigField.position:
                this.setOption(settingsKey, value, POSITION_OPTIONS);
                break;
            case ConfigField.maxCount:
            case ConfigField.offset:
            case ConfigField.roundness:
            case ConfigField.size:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.color:
            case ConfigField.borderColor:
            case ConfigField.fontColor:
                this.setColor(settingsKey, value);
                break;
        }
    }

}
