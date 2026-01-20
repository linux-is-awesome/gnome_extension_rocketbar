import SettingsPage from '../base/settingsPage.js';
import { Config } from '../../../shared/utils/config.js';
import { PreferencesPage, Alignment } from '../../../shared/enums/general.js';
import { ConfigOptions, ColorType,
         IndicatorsConfigField as ConfigField } from '../../../shared/enums/taskbar.js';

const POSITION_OPTIONS = [
    Alignment.Top,
    Alignment.Bottom
];

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.TaskbarIndicators, () => this.#initialize(), ConfigOptions.path);
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
            case ConfigField.limitActive:
            case ConfigField.limitInactive:
            case ConfigField.offsetActive:
            case ConfigField.offsetInactive:
            case ConfigField.sizeActive:
            case ConfigField.sizeInactive:
            case ConfigField.spacingActive:
            case ConfigField.spacingInactive:
            case ConfigField.weightActive:
            case ConfigField.weightInactive:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.colorActive:
            case ConfigField.colorInactive:
                this.setColor(settingsKey, value);
                break;
            case ConfigField.colorTypeActive:
            case ConfigField.colorTypeInactive:
                this.setOption(settingsKey, value, Object.values(ColorType));
                const colorWidgetId = settingsKey === ConfigField.colorTypeActive ?
                                      ConfigField.colorActive : ConfigField.colorInactive;
                const colorRow = this.getActionRow(`${colorWidgetId}-row`);
                colorRow.set_visible(value === ColorType.Static);
                break;
            case ConfigField.hasInactiveLayout:
            case ConfigField.hasInactiveColor:
                this.setBoolean(settingsKey, value);
                break;
        }
    }

}
