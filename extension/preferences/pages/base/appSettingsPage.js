/**
 * @typedef {import('gi://Gtk').Image} Gtk.Image
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import Gio from 'gi://Gio';
import { SettingsPageBase } from './settingsPage.js';
import { AppConfig } from '../../../shared/utils/taskbar/appConfig.js';

const DEFAULT_APP_ICON_NAME = 'application-x-executable';

export default class AppSettingsPage extends SettingsPageBase {

    /** @type {Map<string, Gio.AppInfo>?} */
    static #appsById = null;

    /** @type {AppConfig?} */
    static #appConfig = null;

    /** @type {string?} */
    #appId = null;

    /** @type {AppConfig} */
    get #configProvider() {
        AppSettingsPage.#appConfig ??= new AppConfig();
        return AppSettingsPage.#appConfig;
    }

    /** @type {Map<string, Gio.AppInfo>} */
    get appsById() {
        if (AppSettingsPage.#appsById) return AppSettingsPage.#appsById;
        AppSettingsPage.#appsById = new Map();
        for (const app of Gio.AppInfo.get_all()) {
            const appId = app.get_id();
            if (!appId) continue;
            AppSettingsPage.#appsById.set(appId, app);
        }
        return AppSettingsPage.#appsById;
    }

    /**
     * @param {string?} appId
     * @param {((settingsKey?: string?) => void)?} [callback]
     * @returns {Config?}
     */
    getAppConfig(appId, callback) {
        const oldAppId = this.#appId;
        this.#appId = appId ?? null;
        const isAppIdChanged = oldAppId && oldAppId !== appId;
        const result = !appId ? null : typeof callback === 'function' ?
                       this.#configProvider.get(appId, this, callback) :
                       this.#configProvider.get(appId);
        if (isAppIdChanged) this.#configProvider.destroy(oldAppId, this);
        return result;
    }

    /**
     * @param {string?} appId
     * @param {string} [key]
     * @returns {boolean}
     */
    hasOverride(appId, key) {
        return this.#configProvider.hasOverride(appId, key);
    }

    /**
     * @param {string} appId
     * @param {string} key
     * @param {*} value
     */
    setOverride(appId, key, value) {
        this.#configProvider.setOverride(appId, key, value);
    }

    /**
     * @param {string} appId
     */
    resetOverride(appId) {
        this.#configProvider.resetOverride(appId);
    }

    /**
     * @param {Gtk.Image} widget
     * @param {Gio.AppInfo?} [appInfo]
     */
    setAppIcon(widget, appInfo) {
        const gicon = appInfo?.get_icon() ?? null;
        if (gicon) widget.set_from_gicon(gicon);
        else widget.set_from_icon_name(DEFAULT_APP_ICON_NAME);
    }

}
