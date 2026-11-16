import Gtk from 'gi://Gtk';
import AppSettingsPage from '../base/appSettingsPage.js';
import { Event, PreferencesPage } from '../../../shared/enums/general.js';
import { ConfigKey,
         AppConfigField,
         AppButtonConfigField,
         ActivationBehavior,
         AttentionBehavior,
         NotificationsBehavior,
         PreferredMonitor } from '../../../shared/enums/taskbar.js';

const RESET_SUFFIX = '-reset';

/** @enum {string} */
const Widget = {
    Title: 'page-title',
    AppHeaderIcon: 'app-header-icon',
    ResetAll: 'reset-all'
};

/** @enum {string} */
const ConfigField = {
    activationBehavior: AppConfigField.activationBehavior,
    attentionBehavior: AppConfigField.attentionBehavior,
    attentionNotificationsBehavior: AppConfigField.attentionNotificationsBehavior,
    notificationsBehavior: AppConfigField.notificationsBehavior,
    preferredMonitor: AppConfigField.preferredMonitor,
    iconSize: AppButtonConfigField.iconSize
};

/** @enum {string} */
const OverrideKey = {
    [ConfigField.activationBehavior]: ConfigKey.ActivationBehavior,
    [ConfigField.attentionBehavior]: ConfigKey.AttentionBehavior,
    [ConfigField.attentionNotificationsBehavior]: ConfigKey.AttentionNotificationsBehavior,
    [ConfigField.notificationsBehavior]: ConfigKey.NotificationsBehavior,
    [ConfigField.preferredMonitor]: ConfigKey.PreferredMonitor,
    [ConfigField.iconSize]: ConfigKey.IconSize
};

export default class extends AppSettingsPage {

    /** @type {string?} */
    #appId = null;

    constructor() {
        super(PreferencesPage.TaskbarAppConfig, (...args) => this.#initialize(...args));
    }

    /**
     * @param {boolean} [isInitialized]
     * @param {{appId?: string}} [params]
     * @returns {boolean}
     */
    #initialize(isInitialized, params = {}) {
        if (!isInitialized) {
            for (const key in ConfigField) this.#connectResetButton(ConfigField[key]);
            const resetAllButton = this.getActionRow(Widget.ResetAll);
            resetAllButton.connect(Event.Activated, () => this.#resetAll());
        }
        const { appId = null } = params;
        this.#appId = appId;
        this.#loadAppConfig();
        return false;
    }

    /**
     * @param {string} settingsKey
     */
    #connectResetButton(settingsKey) {
        const resetButton = this.getWidget(`${settingsKey}${RESET_SUFFIX}`);
        if (resetButton instanceof Gtk.Button === false) return;
        resetButton.connect(Event.Clicked, () => {
            if (!this.#appId) return;
            this.setOverride(this.#appId, OverrideKey[settingsKey], null);
            this.#handleAppConfig();
        });
    }

    #resetAll() {
        if (!this.#appId) return;
        this.resetOverride(this.#appId);
        this.#handleAppConfig();
    }

    #loadAppConfig() {
        if (!this.#appId) return this.#updateResetButtons();
        const app = this.appsById.get(this.#appId);
        if (!app) return;
        const title = this.getTitle(Widget.Title);
        const appIcon = this.getImage(Widget.AppHeaderIcon);
        title.set_subtitle(app.get_display_name() ?? '');
        this.setAppIcon(appIcon, app);
        this.#handleAppConfig();
    }

    #handleAppConfig() {
        if (!this.#appId) return;
        const config = this.getAppConfig(this.#appId, () => this.#handleAppConfig());
        if (!config) return;
        for (const key in ConfigField) {
            const settingsKey = ConfigField[key];
            this.#handleConfig(settingsKey, config[key]);
        }
        this.#updateResetButtons();
    }

    /**
     * @param {string} settingsKey
     * @param {*} value
     */
    #handleConfig(settingsKey, value) {
        switch (settingsKey) {
            case ConfigField.preferredMonitor:
                this.setOption(settingsKey, value, Object.values(PreferredMonitor));
                break;
            case ConfigField.activationBehavior:
                this.setOption(settingsKey, value, Object.values(ActivationBehavior));
                break;
            case ConfigField.attentionBehavior:
                this.setOption(settingsKey, value, Object.values(AttentionBehavior));
                break;
            case ConfigField.attentionNotificationsBehavior:
            case ConfigField.notificationsBehavior:
                this.setOption(settingsKey, value, Object.values(NotificationsBehavior));
                break;
            case ConfigField.iconSize:
                this.setNumber(settingsKey, value);
                break;
        }
    }

    /**
     * @override
     * @param {string} settingsKey
     * @param {*} value
     */
    setValue(settingsKey, value) {
        if (!this.#appId) return;
        this.setOverride(this.#appId, OverrideKey[settingsKey], value);
    }

    #updateResetButtons() {
        const hasOverride = !!this.#appId && this.hasOverride(this.#appId);
        for (const key in ConfigField) {
            const settingsKey = ConfigField[key];
            const resetButton = this.getWidget(`${settingsKey}${RESET_SUFFIX}`);
            if (resetButton instanceof Gtk.Button === false) continue;
            const isActive = hasOverride && this.hasOverride(this.#appId, OverrideKey[settingsKey]);
            resetButton.set_sensitive(isActive);
        }
        this.getActionRow(Widget.ResetAll).set_sensitive(hasOverride);
    }

}
