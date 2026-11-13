import Gio from 'gi://Gio';
import SettingsPage from '../base/settingsPage.js';
import { PreferencesPage } from '../../../shared/enums/general.js';
import { ConfigOptions } from '../../../shared/enums/taskbar.js';

/** @enum {string} */
const Widget = {
    Title: 'page-title'
};

export default class extends SettingsPage {

    /** @type {Map<string, Gio.AppInfo>} */
    #appsById = new Map();

    constructor() {
        super(PreferencesPage.TaskbarAppConfig, (...args) => this.#initialize(...args), ConfigOptions.path);
    }

    /**
     * @param {boolean} [isInitialized]
     * @param {{appId?: string}} [params]
     * @returns {boolean}
     */
    #initialize(isInitialized, params) {
        if (!isInitialized) {
            const apps = Gio.AppInfo.get_all();
            for (const app of apps) this.#appsById.set(app.get_id() ?? '', app);
        }
        this.#loadAppConfig(params?.appId ?? null);
        return false;
    }

    /**
     * @param {string?} appId
     */
    #loadAppConfig(appId) {
        appId ??= '';
        const title = this.getTitle(Widget.Title);
        title.set_subtitle(this.#appsById.get(appId)?.get_display_name() ?? '');
    }

}
