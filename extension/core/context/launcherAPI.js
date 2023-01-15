/* exported LauncherAPI */

import Gio from 'gi://Gio';
import { Type } from '../enums.js';

const DBUS_NAME = 'com.canonical.Unity';
const DBUS_SIGNAL_SOURCE = 'com.canonical.Unity.LauncherEntry';

export class LauncherAPI {

    /** @type {number} */
    #connectionId = null;

    /** @type {Map<*, number>} */
    #clients = new Map();

    constructor() {
        this.#connectionId = Gio.DBus.session.own_name(
            DBUS_NAME,
            Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT | Gio.BusNameOwnerFlags.REPLACE,
            null, () => this.#connectionId = null
        );
    }

    destroy() {
        if (this.#connectionId) Gio.DBus.session.unown_name(this.#connectionId);
        this.#connectionId = null;
        if (!this.#clients) return;
        for (const [_, id] of this.#clients) Gio.DBus.session.signal_unsubscribe(id);
        this.#clients = null;
    }

    /**
     * @param {*} client
     * @param {(...args) => void} callback
     */
    connect(client, callback) {
        if (!this.#clients || this.#clients.has(client)) return;
        if (typeof callback !== Type.Function) return;
        const id = Gio.DBus.session.signal_subscribe(
            null, DBUS_SIGNAL_SOURCE, null, null, null, Gio.DBusSignalFlags.NONE,
            (_,__,___,____,_____, params) => callback(params)
        );
        this.#clients.set(client, id);
    }

    /**
     * @param {*} client
     */
    disconnect(client) {
        if (!this.#clients?.has(client)) return;
        Gio.DBus.session.signal_unsubscribe(this.#clients.get(client));
        this.#clients.delete(client);
    }

}
