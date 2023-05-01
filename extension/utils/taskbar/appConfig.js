/* exported ConfigFields, ActivateBehavior, DemandsAttentionBehavior, AppIconSize, AppConfig */

/** @typedef {import('./appButton.js').AppButton} AppButton */
/** @typedef {Object.<string, string|number|boolean>} Config */

import { Context } from '../../core/context.js';
import { Config } from '../config.js';
import { Type } from '../../core/enums.js';

const CONFIG_OVERRIDE_SETTINGS_KEY = 'appbutton-config-override';

/** @enum {string} */
export const ConfigFields = {
    isolateWorkspaces: 'taskbar-isolate-workspaces',
    enableIndicators: 'appbutton-enable-indicators',
    enableMinimizeAction: 'appbutton-enable-minimize-action',
    activateBehavior: 'appbutton-running-app-activate-behavior',
    demandsAttentionBehavior: 'appbutton-demands-attention-behavior',
    enableSoundControl: 'appbutton-enable-sound-control',
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
    MoveWindows: 'move_windows',
};

/** @enum {string} */
export const DemandsAttentionBehavior = {
    FocusActive: 'focus_active',
    FocusAll: 'focus_all'
};

/** @enum {number} */
export const AppIconSize = {
    Min: 16,
    Max: 64
};

/** @type {Object.<string, string|number>} */
const DefaultConfigOverride = {
    iconSizeOffset: 0,
    iconPath: null,
    activateBehavior: ActivateBehavior.NewWindow,
    demandsAttentionBehavior: DemandsAttentionBehavior.FocusActive
};

export class AppConfig {

    /** @type {Map<Shell.App, {config: Config, callback: (settingsKey: string) => void}>} */
    #appConfig = new Map();

    /** @type {Object.<string, Config>} */
    #configOverride = {};

    /** @type {Config} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /** @type {Config} */
    get defaultConfig() {
        return this.#config;
    }

    constructor() {
        const configOverride = Context.settings.get_string(CONFIG_OVERRIDE_SETTINGS_KEY);
        if (!configOverride?.length) return;
        try {
            this.#configOverride = JSON.parse(configOverride);
        } catch (e) {
            console.error(Context.metadata?.name, e)
        }
    }

    /**
     * @param {Shell.App} app
     * @returns {boolean}
     */
    destroy(app) {
        if (!this.#appConfig?.has(app)) return false;
        this.#appConfig.delete(app);
        if (this.#appConfig.size) return false;
        Context.signals.removeAll(this);
        return true;
    }

    /**
     * @param {Shell.App} app
     * @param {(settingsKey: string) => void} callback
     * @returns {Config}
     */
    getConfig(app, callback) {
        if (this.#appConfig.has(app)) return this.#appConfig.get(app).config;
        if (!app?.id || typeof callback !== Type.Function) return null;
        const config = this.#getAppConfig(app);
        this.#appConfig.set(app, { config, callback });
        return config;
    }

    /**
     * @param {Shell.App} app
     * @returns {boolean}
     */
    hasConfigOverride(app) {
        return this.#configOverride[app?.id] ? true : false;
    }

    /**
     * @param {Shell.App} app
     * @param {string} field
     * @param {string|number|boolean} value
     */
    setConfigOverride(app, field, value) {
        if (!app?.id || !this.#appConfig?.has(app)) return;
        if (!Object.keys(ConfigFields).includes(field)) return;
        const configOverride = this.#configOverride[app.id] ?? {};
        const settingsKey = ConfigFields[field];
        switch (settingsKey) {
            case ConfigFields.iconSize:
                value -= this.#config.iconSize;
                if (configOverride.iconSizeOffset === value) return;
                configOverride.iconSizeOffset = value;
                break;
            case ConfigFields.activateBehavior:
            case ConfigFields.demandsAttentionBehavior:
                if (!Object.values(({
                    [ConfigFields.activateBehavior]: ActivateBehavior,
                    [ConfigFields.demandsAttentionBehavior]: DemandsAttentionBehavior
                })[settingsKey]).includes(value)) return;
            default:
                if (configOverride[field] === value) return;
                configOverride[field] = value;
        }
        this.#configOverride[app.id] = configOverride;
        this.#saveConfigOverride();
        this.#setAppConfig(app, this.#appConfig.get(app), settingsKey);
    }

    /**
     * @param {Shell.App} app
     */
    resetConfigOverride(app) {
        if (!app?.id || !this.#appConfig?.has(app)) return;
        if (!this.#configOverride[app.id]) return;
        delete this.#configOverride[app.id];
        this.#saveConfigOverride();
        this.#setAppConfig(app, this.#appConfig.get(app));
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        if (!this.#appConfig?.size) return;
        for (const [app, client] of this.#appConfig) this.#setAppConfig(app, client, settingsKey);
    }

    /**
     * @param {Shell.App} app
     * @param {{config: Config, callback: (settingsKey: string) => void}} client
     * @param {string} settingsKey
     */
    #setAppConfig(app, client, settingsKey) {
        const { config, callback } = client;
        const newConfig = this.#getAppConfig(app);
        for (const field in newConfig) {
            config[field] = newConfig[field];
        }
        callback(settingsKey);
    }

    /**
     * @param {Shell.App} app
     * @returns {Config}
     */
    #getAppConfig(app) {
        const configOverride = this.#getConfigOverride(app?.id);
        const { iconSizeOffset, iconPath, activateBehavior, demandsAttentionBehavior } = configOverride;
        let { iconSize, iconHPadding, iconVPadding } = this.#config;
        const width = iconSize + iconHPadding * 2;
        const height = iconSize + iconVPadding * 2;
        iconSize += iconSizeOffset;
        iconSize = Math.max(iconSize, AppIconSize.Min);
        iconSize = Math.min(iconSize, AppIconSize.Max);
        return { ...this.#config, ...{ iconSize, iconPath, width, height, activateBehavior, demandsAttentionBehavior } };
    }

    /**
     * @param {string} appId
     * @returns {DefaultConfigOverride}
     */
    #getConfigOverride(appId) {
        const configOverride = this.#configOverride[appId] ?? {};
        return { ...DefaultConfigOverride, ...{
            activateBehavior: this.#config.activateBehavior,
            demandsAttentionBehavior: this.#config.demandsAttentionBehavior
        }, ...configOverride };
    }

    async #saveConfigOverride() {
        Context.settings.set_string(CONFIG_OVERRIDE_SETTINGS_KEY, JSON.stringify(this.#configOverride));
    }
    
}
