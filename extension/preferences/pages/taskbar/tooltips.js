import SettingsPage from '../base/settingsPage.js';
import { Config } from '../../../shared/utils/config.js';
import { PreferencesPage } from '../../../shared/enums/general.js';
import { ConfigOptions,
         TooltipConfigField as ConfigField } from '../../../shared/enums/taskbar.js';

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.TaskbarTooltips, () => this.#initialize(), ConfigOptions.path);
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
            case ConfigField.showDelay:
            case ConfigField.hideDelay:
            case ConfigField.maxLength:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.shrinkWindowTitles:
                this.setBoolean(settingsKey, value);
                break;
        }
    }

}
