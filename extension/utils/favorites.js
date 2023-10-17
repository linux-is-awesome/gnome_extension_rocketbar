/* exported Favorites */

import Shell from 'gi://Shell';
import { getAppFavorites } from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { Connections } from './connections.js';

export class Favorites {

    constructor(callback) {
        this._callback = callback;
        this._apps = null;
        this._appFavorites = getAppFavorites();
        this._connections = new Connections();
        this._connections.add(Shell.AppSystem.get_default(), 'installed-changed', () => this._handleInstalledChanged());
        this._connections.add(this._appFavorites, 'changed', () => this._handleChanged());
    }

    destroy() {
        this._connections.destroy();
    }

    getApps() {

        if (!this._apps) {
            this._apps = this._appFavorites.getFavorites();
        }

        return this._apps;
    }

    addApp(appId) {
        this._appFavorites.addFavorite(appId);
    }

    moveAppToPosition(appId, position) {

        // in this case we can't relay on this._apps
        // because it can be null at some point of time
        const appIds = this._appFavorites._getIds();

        const oldPosition = appIds.indexOf(appId);

        // check if the position hasn't changed
        if (position === oldPosition) {
            return;
        }

        this._appFavorites.moveFavoriteToPos(appId, position);
    }

    _handleChanged() {

        if (this._apps && this._callback) {
            this._callback();
        }

        this._apps = null;
    }

    _handleInstalledChanged() {

        const oldAppIds = this._getAppIds();
        const newAppIds = this._appFavorites._getIds().toString();

        // nothing has changed
        if (oldAppIds === newAppIds) {
            return;
        }

        this._apps = null;

        if (this._callback) {
            this._callback();
        }
    }

    _getAppIds() {

        if (!this._apps) {
            return '';
        }

        let result = [];

        for (let i = 0, l = this._apps.length; i < l; ++i) {
            result.push(this._apps[i].id);
        }

        return result.toString();
    }

}
