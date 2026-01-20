import SettingsPage from '../base/settingsPage.js';
import { Config } from '../../../shared/utils/config.js';
import { PreferencesPage } from '../../../shared/enums/general.js';
import { ConfigOptions,
         AppButtonConfigField as ConfigField,
         ScrollAction,
         ColorType } from '../../../shared/enums/taskbar.js';

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.TaskbarAppButton, () => this.#initialize(), ConfigOptions.path);
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
            case ConfigField.enableMenus:
            case ConfigField.enableDragAndDrop:
            case ConfigField.enableMinimizeAction:
                this.setBoolean(settingsKey, value);
                break;
            case ConfigField.enableSoundControl:
                this.setBoolean(settingsKey, value);
                if (value) return;
                const scrollAction = this.#config.scrollAction;
                if (scrollAction !== ScrollAction.ChangeInputSoundVolume &&
                    scrollAction !== ScrollAction.ChangeOutputSoundVolume) return;
                this.setOption(ConfigField.scrollAction, ScrollAction.None, Object.values(ScrollAction));
                break;
            case ConfigField.iconSize:
            case ConfigField.iconHPadding:
            case ConfigField.iconVPadding:
            case ConfigField.roundness:
            case ConfigField.spacingAfter:
            case ConfigField.backlightIntensity:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.backlightColor:
                this.setColor(settingsKey, value);
                break;
            case ConfigField.scrollAction:
                this.setOption(settingsKey, value, Object.values(ScrollAction));
                if (value !== ScrollAction.ChangeInputSoundVolume &&
                    value !== ScrollAction.ChangeOutputSoundVolume) return;
                this.setBoolean(ConfigField.enableSoundControl, true);
                break;
            case ConfigField.backlightColorType:
                this.setOption(settingsKey, value, Object.values(ColorType));
                const colorRow = this.getActionRow(`${ConfigField.backlightColor}-row`);
                colorRow.set_visible(value === ColorType.Static);
                break;
        }
    }

}
