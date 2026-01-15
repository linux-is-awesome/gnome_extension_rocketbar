/**
 * @typedef {import('../config.js').Config} Config
 * @typedef {{config?: Config?, clients?: Map<*, ((settingsKey?: string?) => void)?>}} AppConfigDetails
 */

import Context from '../../core/context.js';
import { SharedConfig, InnerConfig } from '../config.js';
import { SettingsKey } from '../../enums/settings.js';
import { AppButtonConfigField,
         AppConfigField,
         ConfigOptions,
         AppIconSize,
         ActivationBehavior,
         AttentionBehavior,
         NotificationsBehavior,
         PreferredMonitor } from '../../enums/taskbar.js';

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
    attentionNotificationsBehavior: NotificationsBehavior.Default,
    notificationsBehavior: NotificationsBehavior.Default
};

/**
 * @param {string?} appId
 * @param {{[appId: string]: Config}?} appConfig
 * @param {Config} defaultConfig
 * @param {string} configKey
 * @returns {* & (boolean|number|string|null)}
 */
export const AppConfigValue = (appId, appConfig, defaultConfig, configKey) => {
    return (appId && appConfig ? appConfig[appId]?.[configKey] : null) ??
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
     * @param {string?} [appId]
     * @param {*} [client]
     * @returns {boolean}
     */
    destroy(appId, client) {
        if (!this.has(appId)) return super.destroy(appId);
        /** @type {AppConfigDetails} */
        const { clients } = this.getDetails(appId) ?? {};
        clients?.delete(client);
        if (clients?.size) return false;
        return super.destroy(appId);
    }

    /**
     * @override
     * @param {string?} appId
     * @param {*} [client]
     * @param {((settingsKey?: string?) => void)?} [callback]
     * @returns {Config?}
     */
    get(appId, client, callback) {
        if (!appId) return null;
        if (this.has(appId) && !client) return this.getDetails(appId)?.config ?? null;
        if (!client) return null;
        /** @type {AppConfigDetails?} */
        const appConfig = this.getDetails(appId);
        if (!appConfig) return null;
        if (appConfig.config && appConfig.clients) {
            appConfig.clients.set(client, callback ?? null);
            return appConfig.config;
        }
        appConfig.config = this.#getAppConfig(appId);
        appConfig.clients = new Map([[client, callback ?? null]]);
        return appConfig.config;
    }

    /**
     * @param {string?} appId
     * @param {string} [key]
     * @returns {boolean}
     */
    hasOverride(appId, key) {
        if (!appId) return false;
        const appConfig = this.#configOverride[appId];
        if (!appConfig) return false;
        if (key) return new Set(Object.keys(appConfig)).has(key);
        return true;
    }

    /**
     * @param {string?} appId
     * @param {string} key
     * @param {*} value
     */
    setOverride(appId, key, value) {
        if (!appId || !this.has(appId)) return;
        if (!Object.keys(ConfigField).includes(key)) return;
        const configOverride = this.#configOverride[appId] ?? {};
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
            case ConfigField.notificationsBehavior:
            case ConfigField.preferredMonitor:
                if (!Object.values({
                    [ConfigField.activationBehavior]: ActivationBehavior,
                    [ConfigField.preferredMonitor]: PreferredMonitor,
                    [ConfigField.attentionBehavior]: AttentionBehavior,
                    [ConfigField.attentionNotificationsBehavior]: NotificationsBehavior,
                    [ConfigField.notificationsBehavior]: NotificationsBehavior
                }[settingsKey]).includes(value)) return;
            default:
                if (configOverride[key] === value) return;
                if (!value) delete configOverride[key];
                else configOverride[key] = value;
        }
        if (!Object.keys(configOverride).length) return this.resetOverride(appId);
        this.#configOverride[appId] = configOverride;
        this.#saveOverride();
        this.#setAppConfig([appId, this.getDetails(appId)], settingsKey);
    }

    /**
     * @param {string?} appId
     */
    resetOverride(appId) {
        if (!appId || !this.has(appId)) return;
        if (!this.#configOverride[appId]) return;
        delete this.#configOverride[appId];
        this.#saveOverride();
        this.#setAppConfig([appId, this.getDetails(appId)]);
    }

    /**
     * @param {[appId: string, AppConfigDetails]} appConfig
     * @param {string?} [settingsKey]
     */
    #setAppConfig([appId, details], settingsKey) {
        const { config, clients } = details;
        if (!config) return;
        const newConfig = this.#getAppConfig(appId);
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
     * @param {string} appId
     * @returns {Config?}
     */
    #getAppConfig(appId) {
        const defaultConfig = super.get();
        if (!appId || !defaultConfig) return null;
        const configOverride = this.#getOverride(appId);
        const { iconSizeOffset, iconPath, activationBehavior,
                preferredMonitor, attentionBehavior,
                attentionNotificationsBehavior, notificationsBehavior } = configOverride;
        let { iconSize, iconHPadding, iconVPadding } = defaultConfig;
        const width = iconSize + iconHPadding * 2;
        const height = iconSize + iconVPadding * 2;
        iconSize += iconSizeOffset;
        iconSize = Math.max(iconSize, AppIconSize.Min);
        iconSize = Math.min(iconSize, AppIconSize.Max);
        const overrideResult = { iconSize, iconPath, width, height,
                                 activationBehavior, preferredMonitor,
                                 attentionBehavior, attentionNotificationsBehavior,
                                 notificationsBehavior };
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
                attentionNotificationsBehavior,
                notificationsBehavior } = super.get() ?? {};
        const configOverride = this.#configOverride[appId] ?? {};
        const defaultConfig = { activationBehavior, preferredMonitor, attentionBehavior,
                                attentionNotificationsBehavior, notificationsBehavior };
        return { ...DefaultConfigOverride, ...defaultConfig, ...configOverride };
    }

    #saveOverride() {
        const settings = Context.getSettings(ConfigOptions.path);
        settings?.set(SettingsKey.AppButtonConfigOverride, this.#configOverride);
    }

}
