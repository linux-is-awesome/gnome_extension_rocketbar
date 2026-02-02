import Shell from 'gi://Shell';
import * as SystemFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import Context from '../../core/context.js';
import { Event } from '../../../shared/enums/general.js';

export default class Favorites {

    /** @type {SystemFavorites.AppFavorites?} */
    #favorites = SystemFavorites.getAppFavorites();

    /** @type {Set<Shell.App>?} */
    #apps = null;

    /** @type {Map<string, Shell.App>?} */
    #appsById = null;

    /** @type {(() => void)?} */
    #callback = null;

    /** @type {Map<string, Shell.App>} */
    get appsById() {
        if (this.#appsById) return this.#appsById;
        this.#appsById = new Map();
        if (!this.#favorites) return this.#appsById;
        const appsById = this.#favorites.getFavoriteMap();
        for (const appId in appsById) this.#appsById.set(appId, appsById[appId]);
        return this.#appsById;
    }

    /** @type {Set<Shell.App>} */
    get apps() {
        if (this.#appsById && this.#apps) return this.#apps;
        this.#apps = new Set(this.appsById.values());
        return this.#apps;
    }

    /**
     * @param {() => void} callback
     */
    constructor(callback) {
        if (typeof callback !== 'function') return;
        this.#callback = callback;
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.InstalledChanged, () => this.#handleInstalled()],
            [this.#favorites, Event.Changed, () => this.#handleChanged()]);
        this.#callback();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#favorites = null;
        this.#triggerCallback();
        this.#callback = null;
    }

    /**
     * @param {Shell.App} app
     * @param {number} [position]
     */
    add(app, position = -1) {
        if (!this.#favorites || app instanceof Shell.App === false || !app.id) return;
        const oldPosition = [...this.appsById.keys()].indexOf(app.id);
        if (position === oldPosition) return;
        if (oldPosition < 0) this.#favorites.addFavoriteAtPos(app.id, position);
        else this.#favorites.moveFavoriteToPos(app.id, position);
    }

    /**
     * @param {Shell.App} app
     * @returns {boolean}
     */
    canAdd(app) {
        if (app instanceof Shell.App === false || !app.id || !app.app_info) return false;
        const parentalControlsManager = this.#favorites?._parentalControlsManager;
        const validationFunction = parentalControlsManager?.shouldShowApp;
        if (typeof validationFunction !== 'function') return false;
        return validationFunction(app.app_info);
    }

    /**
     * @param {Shell.App} app
     */
    remove(app) {
        if (!this.#favorites || app instanceof Shell.App === false || !app.id) return;
        this.#favorites.removeFavorite(app.id);
    }

    #handleChanged() {
        if (!this.#appsById) return;
        this.#triggerCallback();
    }

    #handleInstalled() {
        if (!this.#favorites) return;
        const oldAppsById = this.#appsById;
        const newAppsById = this.#favorites.getFavoriteMap() ?? {};
        const newAppsSize = Object.keys(newAppsById).length;
        if (oldAppsById?.size !== newAppsSize) return this.#triggerCallback();
        for (const appId in newAppsById) {
            const newApp = newAppsById[appId];
            const oldApp = oldAppsById?.get(appId);
            if (oldApp && oldApp === newApp) continue;
            return this.#triggerCallback();
        }
    }

    #triggerCallback() {
        if (typeof this.#callback !== 'function') return;
        this.#appsById?.clear();
        this.#appsById = null;
        this.#callback();
    }

}
