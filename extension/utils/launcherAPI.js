/* exported LauncherAPI */

const Gio = imports.gi.Gio;

var LauncherAPI = class {

    static _instance = null;

    static instance() {

        if (!LauncherAPI._instance) {
            LauncherAPI._instance = new LauncherAPI();
        }

        return LauncherAPI._instance;
    }

    static destroy() {
        LauncherAPI._instance?.destroy();
        LauncherAPI._instance = null;
    }

    constructor() {
        this._dbusId = Gio.DBus.session.own_name(
            'com.canonical.Unity',
            Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT | Gio.BusNameOwnerFlags.REPLACE,
            null,
            () => this._dbusId = null
        );
    }

    destroy() {

        if (!this._dbusId) {
            return;
        }

        Gio.DBus.session.unown_name(this._dbusId);
    }

    subscribe(callback) {

        if (!callback) {
            return null;
        }

        return Gio.DBus.session.signal_subscribe(
            null, 'com.canonical.Unity.LauncherEntry',
            null, null, null,
            Gio.DBusSignalFlags.NONE,
            (connection, sender, path, name, signal, params) => callback(params)
        );
    }

    unsubscribe(id) {

        if (!id) {
            return;
        }

        Gio.DBus.session.signal_unsubscribe(id);
    }

}