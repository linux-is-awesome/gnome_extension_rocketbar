/**
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('../config.js').Config} Config
 * @typedef {{config?: Config?, clients?: Map<*, ((settingsKey?: string?) => void)?>}} AppConfigDetails
 */

import Context from '../../main/context.js';
import { SharedConfig, InnerConfig } from '../config.js';

const CONFIG_PATH = 'taskbar';
const CONFIG_OVERRIDE_SETTINGS_KEY = 'appbutton-config-override';

/** @enum {string} */
export const ConfigFields = {
    isolateWorkspaces: 'taskbar-isolate-workspaces',
    showAllWindows: 'taskbar-show-all-windows',
    windowRouting: 'multi-monitor-window-routing',
    windowsPreferredMonitor: 'windows-preferred-monitor',
    enableIndicators: 'appbutton-enable-indicators',
    enableMenus: 'appbutton-enable-menus',
    enableTooltips: 'appbutton-enable-tooltips',
    enableMinimizeAction: 'appbutton-enable-minimize-action',
    activateBehavior: 'appbutton-running-app-activate-behavior',
    demandsAttentionBehavior: 'appbutton-demands-attention-behavior',
    enableSoundControl: 'appbutton-enable-sound-control',
    enableNotificationBadges: 'appbutton-enable-notification-badges',
    enableProgressBars: 'appbutton-enable-progress-bars',
    iconSize: 'appbutton-icon-size',
    iconPath: '~appbutton-icon-path',
    iconHPadding: 'appbutton-icon-padding',
    iconVPadding: 'appbutton-icon-vertical-padding',
    spacingAfter: 'appbutton-spacing',
    roundness: 'appbutton-roundness',
    backlightColor: 'appbutton-backlight-color',
    backlightIntensity: 'appbutton-backlight-intensity',
    backlightDominantColor: 'appbutton-backlight-dominant-color'
};

/** @enum {string} */
export const ActivateBehavior = {
    NewWindow: 'new_window',
    FindWindow: 'find_window',
    MoveWindows: 'move_windows'
};

/** @enum {string} */
export const DemandsAttentionBehavior = {
    Default: 'default',
    FocusActive: 'focus_active',
    FocusAll: 'focus_all'
};

/** @enum {string} */
export const PreferredMonitor = {
    Default: 'default',
    Primary: 'primary',
    Left: 'left',
    Right: 'right',
    Above: 'above',
    Below: 'below'
};

/** @enum {number} */
export const AppIconSize = {
    Min: 16,
    Max: 64
};

/** @type {Config}*/
const DefaultConfigOverride = {
    iconSizeOffset: 0,
    iconPath: null,
    activateBehavior: ActivateBehavior.NewWindow,
    demandsAttentionBehavior: DemandsAttentionBehavior.Default,
    windowsPreferredMonitor: PreferredMonitor.Default
};

export class AppConfig extends SharedConfig {

    /** @type {{[appId: string]: Config}} */
    #configOverride = {};

    /** @type {Config} */
    get defaultConfig() {
        return super.getConfig() ?? {};
    }

    constructor() {
        super(ConfigFields, { path: CONFIG_PATH });
        this.configHandler = this.#setAppConfig;
        const settings = Context.getSettings(CONFIG_PATH);
        if (!settings) return;
        this.#configOverride = InnerConfig(settings, CONFIG_OVERRIDE_SETTINGS_KEY) ?? {};
    }

    /**
     * @override
     * @param {Shell.App?} app
     * @param {*} [client]
     * @returns {boolean}
     */
    destroy(app, client) {
        if (!this.hasClient(app)) return super.destroy(app);
        /** @type {AppConfigDetails} */
        const { clients } = this.getClientDetails(app) ?? {};
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
    getConfig(app, client, callback) {
        if (!app?.id) return null;
        if (this.hasClient(app) && !client) return this.getClientDetails(app)?.config ?? null;
        if (!client) return null;
        /** @type {AppConfigDetails?} */
        const appConfig = this.getClientDetails(app);
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
     * @param {string} [field]
     * @returns {boolean}
     */
    hasConfigOverride(app, field) {
        if (!app?.id) return false;
        const appConfig = this.#configOverride[app?.id];
        if (!appConfig) return false;
        if (field) return new Set(Object.keys(appConfig)).has(field);
        return true;
    }

    /**
     * @param {Shell.App} app
     * @param {string} field
     * @param {*} value
     */
    setConfigOverride(app, field, value) {
        if (!app?.id || !this.hasClient(app)) return;
        if (!Object.keys(ConfigFields).includes(field)) return;
        const configOverride = this.#configOverride[app.id] ?? {};
        const settingsKey = ConfigFields[field];
        switch (settingsKey) {
            case ConfigFields.iconSize:
                if (typeof value !== 'number') return;
                const defaultConfig = super.getConfig();
                value -= defaultConfig?.iconSize;
                if (configOverride.iconSizeOffset === value) return;
                configOverride.iconSizeOffset = value;
                break;
            case ConfigFields.activateBehavior:
            case ConfigFields.demandsAttentionBehavior:
            case ConfigFields.windowsPreferredMonitor:
                if (!Object.values({
                    [ConfigFields.activateBehavior]: ActivateBehavior,
                    [ConfigFields.demandsAttentionBehavior]: DemandsAttentionBehavior,
                    [ConfigFields.windowsPreferredMonitor]: PreferredMonitor
                }[settingsKey]).includes(value)) return;
            default:
                if (configOverride[field] === value) return;
                if (!value) delete configOverride[field];
                else configOverride[field] = value;
        }
        if (!Object.keys(configOverride).length) return this.resetConfigOverride(app);
        this.#configOverride[app.id] = configOverride;
        this.#saveConfigOverride();
        this.#setAppConfig([app, this.getClientDetails(app)], settingsKey);
    }

    /**
     * @param {Shell.App} app
     */
    resetConfigOverride(app) {
        if (!app?.id || !this.hasClient(app)) return;
        if (!this.#configOverride[app.id]) return;
        delete this.#configOverride[app.id];
        this.#saveConfigOverride();
        this.#setAppConfig([app, this.getClientDetails(app)]);
    }

    /**
     * @param {[Shell.App, AppConfigDetails]} appConfig
     * @param {string?} [settingsKey]
     */
    #setAppConfig([app, details], settingsKey) {
        const { config, clients } = details;
        if (!config) return;
        const newConfig = this.#getAppConfig(app);
        for (const field in newConfig) {
            config[field] = newConfig[field];
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
        const defaultConfig = super.getConfig();
        if (!app?.id || !defaultConfig) return null;
        const configOverride = this.#getConfigOverride(app.id);
        const { iconSizeOffset, iconPath, activateBehavior,
                demandsAttentionBehavior, windowsPreferredMonitor } = configOverride;
        let { iconSize, iconHPadding, iconVPadding } = defaultConfig;
        const width = iconSize + iconHPadding * 2;
        const height = iconSize + iconVPadding * 2;
        iconSize += iconSizeOffset;
        iconSize = Math.max(iconSize, AppIconSize.Min);
        iconSize = Math.min(iconSize, AppIconSize.Max);
        const overrideResult = { iconSize, iconPath, width, height,
                                 activateBehavior, demandsAttentionBehavior, windowsPreferredMonitor };
        return { ...defaultConfig, ...overrideResult };
    }

    /**
     * @param {string} appId
     * @returns {Config}
     */
    #getConfigOverride(appId) {
        const { activateBehavior,
                demandsAttentionBehavior,
                windowsPreferredMonitor } = super.getConfig() ?? {};
        const configOverride = this.#configOverride[appId] ?? {};
        const defaultConfig = { activateBehavior, demandsAttentionBehavior, windowsPreferredMonitor };
        return { ...DefaultConfigOverride, ...defaultConfig, ...configOverride };
    }

    #saveConfigOverride() {
        const configOverride = JSON.stringify(this.#configOverride);
        Context.getSettings(CONFIG_PATH)?.set_string(CONFIG_OVERRIDE_SETTINGS_KEY, configOverride);
    }

}
