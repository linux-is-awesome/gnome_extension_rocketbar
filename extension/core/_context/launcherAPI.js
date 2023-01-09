/* exported LauncherAPI */

const Extension = imports.ui.extensionSystem.rocketbar;

const Gio = imports.gi.Gio;
const { Type } = Extension.imports.core.enums;

const DBUS_NAME = 'com.canonical.Unity';
const DBUS_SIGNAL_SOURCE = 'com.canonical.Unity.LauncherEntry';

var LauncherAPI = class {

    /** @type {number} */
    #connectionId = null;

    constructor() {
        this.#connectionId = Gio.DBus.session.own_name(
            DBUS_NAME,
            Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT | Gio.BusNameOwnerFlags.REPLACE,
            null, () => this.#connectionId = null
        );
    }

    destroy() {
        if (!this.#connectionId) return; 
        Gio.DBus.session.unown_name(this.#connectionId);
    }

    /**
     * @param {(...args) => void} callback
     * @returns {number}
     */
    connect(callback) {
        if (typeof callback !== Type.Function) return null;
        return Gio.DBus.session.signal_subscribe(
            null, DBUS_SIGNAL_SOURCE, null, null, null, Gio.DBusSignalFlags.NONE,
            (_,__,___,____,_____, params) => callback(params)
        );
    }

    /**
     * @param {number} id
     */
    disconnect(id) {
        if (typeof id !== Type.Number) return;
        Gio.DBus.session.signal_unsubscribe(id);
    }

}
