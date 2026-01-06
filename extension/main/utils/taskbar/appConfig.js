/**
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 * @typedef {{config?: Config?, clients?: Map<*, ((settingsKey?: string?) => void)?>}} AppConfigDetails
 */

import Context from '../../core/context.js';
import { SharedConfig, InnerConfig } from '../../../shared/utils/config.js';
import { SettingsKey } from '../../../shared/enums/settings.js';
import { AppButtonConfigField,
         AppConfigField,
         ConfigOptions,
         AppIconSize,
         ActivationBehavior,
         AttentionBehavior,
         AttentionNotificationsBehavior,
         PreferredMonitor } from '../../../shared/enums/taskbar.js';

/** @enum {string} */
export const ConfigField = {
    ...AppButtonConfigField,
    ...AppConfigField
};

/** @type {Config}*/
const DefaultConfigOverride = {
    iconSizeOffset: 0,
    iconPath: null,
    activationBehavior: ActivationBehavior.Default,
    preferredMonitor: PreferredMonitor.Default,
    attentionBehavior: AttentionBehavior.Default,
    attentionNotificationsBehavior: AttentionNotificationsBehavior.Default
};

/**
 * @param {Shell.App} app
 * @param {{[appId: string]: Config}?} appConfig
 * @param {Config} defaultConfig
 * @param {string} configKey
 * @returns {* & (boolean|number|string|null)}
 */
export const AppConfigValue = (app, appConfig, defaultConfig, configKey) => {
    return (app?.id && appConfig ? appConfig[app.id]?.[configKey] : null) ??
           defaultConfig[configKey] ?? null;
};

export class AppConfig extends SharedConfig {

    /** @type {{[appId: string]: Config}} */
    #configOverride = {};

    /** @type {Config} */
    get defaultConfig() {
        return super.get() ?? {};
    }

    constructor() {
        super(ConfigField, ConfigOptions);
        this.configHandler = this.#setAppConfig;
        const settings = Context.getSettings(ConfigOptions.path);
        if (!settings) return;
        const configOverride = InnerConfig(settings, SettingsKey.AppButtonConfigOverride);
        if (!configOverride || Array.isArray(configOverride)) return;
        this.#configOverride = configOverride;
    }

    /**
     * @override
     * @param {Shell.App?} app
     * @param {*} [client]
     * @returns {boolean}
     */
    destroy(app, client) {
        if (!this.has(app)) return super.destroy(app);
        /** @type {AppConfigDetails} */
        const { clients } = this.getDetails(app) ?? {};
        clients?.delete(client);
        if (clients?.size) return false;
        return super.destroy(app);
    }

    /**
     * @override
     * @param {Shell.App} app
     * @param {*} [client]
     * @param {((settingsKey?: string?) => void)?} [callback]
     * @returns {Config?}
     */
    get(app, client, callback) {
        if (!app?.id) return null;
        if (this.has(app) && !client) return this.getDetails(app)?.config ?? null;
        if (!client) return null;
        /** @type {AppConfigDetails?} */
        const appConfig = this.getDetails(app);
        if (!appConfig) return null;
        if (appConfig.config && appConfig.clients) {
            appConfig.clients.set(client, callback ?? null);
            return appConfig.config;
        }
        appConfig.config = this.#getAppConfig(app);
        appConfig.clients = new Map([[client, callback ?? null]]);
        return appConfig.config;
    }

    /**
     * @param {Shell.App} app
     * @param {string} [key]
     * @returns {boolean}
     */
    hasOverride(app, key) {
        if (!app?.id) return false;
        const appConfig = this.#configOverride[app?.id];
        if (!appConfig) return false;
        if (key) return new Set(Object.keys(appConfig)).has(key);
        return true;
    }

    /**
     * @param {Shell.App} app
     * @param {string} key
     * @param {*} value
     */
    setOverride(app, key, value) {
        if (!app?.id || !this.has(app)) return;
        if (!Object.keys(ConfigField).includes(key)) return;
        const configOverride = this.#configOverride[app.id] ?? {};
        const settingsKey = ConfigField[key];
        switch (settingsKey) {
            case ConfigField.iconSize:
                if (typeof value !== 'number') return;
                const defaultConfig = super.get();
                value -= defaultConfig?.iconSize;
                if (configOverride.iconSizeOffset === value) return;
                configOverride.iconSizeOffset = value;
                break;
            case ConfigField.activationBehavior:
            case ConfigField.attentionBehavior:
            case ConfigField.attentionNotificationsBehavior:
            case ConfigField.preferredMonitor:
                if (!Object.values({
                    [ConfigField.activationBehavior]: ActivationBehavior,
                    [ConfigField.preferredMonitor]: PreferredMonitor,
                    [ConfigField.attentionBehavior]: AttentionBehavior,
                    [ConfigField.attentionNotificationsBehavior]: AttentionNotificationsBehavior
                }[settingsKey]).includes(value)) return;
            default:
                if (configOverride[key] === value) return;
                if (!value) delete configOverride[key];
                else configOverride[key] = value;
        }
        if (!Object.keys(configOverride).length) return this.resetOverride(app);
        this.#configOverride[app.id] = configOverride;
        this.#saveOverride();
        this.#setAppConfig([app, this.getDetails(app)], settingsKey);
    }

    /**
     * @param {Shell.App} app
     */
    resetOverride(app) {
        if (!app?.id || !this.has(app)) return;
        if (!this.#configOverride[app.id]) return;
        delete this.#configOverride[app.id];
        this.#saveOverride();
        this.#setAppConfig([app, this.getDetails(app)]);
    }

    /**
     * @param {[Shell.App, AppConfigDetails]} appConfig
     * @param {string?} [settingsKey]
     */
    #setAppConfig([app, details], settingsKey) {
        const { config, clients } = details;
        if (!config) return;
        const newConfig = this.#getAppConfig(app);
        for (const key in newConfig) {
            config[key] = newConfig[key];
        }
        if (!clients?.size) return;
        const callbacks = clients.values();
        for (const callback of callbacks) {
            if (typeof callback !== 'function') continue;
            callback(settingsKey);
        }
    }

    /**
     * @param {Shell.App} app
     * @returns {Config?}
     */
    #getAppConfig(app) {
        const defaultConfig = super.get();
        if (!app?.id || !defaultConfig) return null;
        const configOverride = this.#getOverride(app.id);
        const { iconSizeOffset, iconPath, activationBehavior, preferredMonitor,
                attentionBehavior, attentionNotificationsBehavior } = configOverride;
        let { iconSize, iconHPadding, iconVPadding } = defaultConfig;
        const width = iconSize + iconHPadding * 2;
        const height = iconSize + iconVPadding * 2;
        iconSize += iconSizeOffset;
        iconSize = Math.max(iconSize, AppIconSize.Min);
        iconSize = Math.min(iconSize, AppIconSize.Max);
        const overrideResult = { iconSize, iconPath, width, height,
                                 activationBehavior, preferredMonitor,
                                 attentionBehavior, attentionNotificationsBehavior };
        return { ...defaultConfig, ...overrideResult };
    }

    /**
     * @param {string} appId
     * @returns {Config}
     */
    #getOverride(appId) {
        const { activationBehavior,
                preferredMonitor,
                attentionBehavior,
                attentionNotificationsBehavior } = super.get() ?? {};
        const configOverride = this.#configOverride[appId] ?? {};
        const defaultConfig = { activationBehavior, preferredMonitor,
                                attentionBehavior, attentionNotificationsBehavior };
        return { ...DefaultConfigOverride, ...defaultConfig, ...configOverride };
    }

    #saveOverride() {
        const settings = Context.getSettings(ConfigOptions.path);
        settings?.set(SettingsKey.AppButtonConfigOverride, this.#configOverride);
    }

}
