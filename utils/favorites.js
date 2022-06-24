const { Shell } = imports.gi;
const AppFavorites = imports.ui.appFavorites;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Connections } = Me.imports.utils.connections;

var Favorites = class Favorites {

    constructor() {
        this._callback = null;
        this._apps = null;
        this._appFavorites = AppFavorites.getAppFavorites();
        this._connections = new Connections();
        this._connections.add(Shell.AppSystem.get_default(), 'installed-changed', () => this._handleInstalledChanged());
        this._connections.add(this._appFavorites, 'changed', () => this._handleChanged());
    }

    connect(callback) {
        this._callback = callback;
        return this;
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