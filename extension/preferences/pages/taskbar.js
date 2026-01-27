import SettingsPage from './base/settingsPage.js';
import Context from '../core/context.js';
import { Config } from '../../shared/utils/config.js';
import { PreferencesPage, Event } from '../../shared/enums/general.js';
import { SettingsKey } from '../../shared/enums/settings.js';
import { ConfigOptions,
         ConfigField as TaskbarConfigField,
         ServiceConfigField,
         AttentionBehavior,
         NotificationsBehavior,
         PreferredMonitor } from '../../shared/enums/taskbar.js';

const APP_BUTTON_NAVIGATION_ROW_ID = 'appbutton';

/** @enum {string} */
const ConfigField = {
    ...TaskbarConfigField,
    ...ServiceConfigField,
    enableMenus: SettingsKey.AppButtonMenus,
    enableIndicators: SettingsKey.AppButtonIndicators,
    enableNotificationBadges: SettingsKey.AppButtonNotificationBadges,
    enableProgressBars: SettingsKey.AppButtonProgressBars,
    enableTooltips: SettingsKey.AppButtonTooltips
};

/** @enum {string} */
const ChildPage = {
    [APP_BUTTON_NAVIGATION_ROW_ID]: PreferencesPage.TaskbarAppButton,
    [SettingsKey.AppButtonIndicators]: PreferencesPage.TaskbarIndicators,
    [SettingsKey.AppButtonNotificationBadges]: PreferencesPage.TaskbarNotificationBadges,
    [SettingsKey.AppButtonProgressBars]: PreferencesPage.TaskbarProgressBars,
    [SettingsKey.AppButtonTooltips]: PreferencesPage.TaskbarTooltips
};

export default class extends SettingsPage {

    /** @type {Config} */
    #config = Config(this, ConfigField, (settingsKey, value) => this.#handleConfig(settingsKey, value), ConfigOptions);

    constructor() {
        super(PreferencesPage.Taskbar, () => this.#initialize(), ConfigOptions.path);
    }

    #initialize() {
        for (const childPage in ChildPage) {
            const childPageRow = this.getActionRow(`${childPage}-row`);
            childPageRow.connect(Event.Activated, () => Context.navigateToPage(ChildPage[childPage]));
        }
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
            case ConfigField.windowRouting:
                this.getComboRow(ConfigField.preferredMonitor).set_sensitive(value);
            case ConfigField.favorites:
            case ConfigField.enableSeparator:
            case ConfigField.isolateWorkspaces:
            case ConfigField.showAllWindows:
            case ConfigField.windowRoutingWatchdog:
            case ConfigField.enableMenus:
            case ConfigField.enableIndicators:
            case ConfigField.enableNotificationBadges:
            case ConfigField.enableProgressBars:
            case ConfigField.enableTooltips:
                this.setBoolean(settingsKey, value);
                break;
            case ConfigField.maxLength:
                this.setNumber(settingsKey, value);
                break;
            case ConfigField.preferredMonitor:
                this.setOption(settingsKey, value, Object.values(PreferredMonitor));
                break;
            case ConfigField.attentionBehavior:
                this.setOption(settingsKey, value, Object.values(AttentionBehavior));
                break;
            case ConfigField.attentionNotificationsBehavior:
            case ConfigField.notificationsBehavior:
                this.setOption(settingsKey, value, Object.values(NotificationsBehavior));
                break;
        }
    }

}
