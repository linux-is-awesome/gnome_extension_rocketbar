/* exported LauncherApiClient */

import Gio from 'gi://Gio';
import { Context } from '../core/context.js';
import { Type } from '../core/enums.js';
import { Config } from '../utils/config.js';

const DBUS_NAME = 'com.canonical.Unity';
const DBUS_SIGNAL_SOURCE = 'com.canonical.Unity.LauncherEntry';
const NOTIFICATIONS_COUNT_KEY = 'count';
const NOTIFICATIONS_COUNT_VISIBLE_KEY = 'count-visible';
const APPID_REGEXP_STRING = /(^\w+:|^)\/\//;

/** @enum {string} */
const ConfigFields = {
    enableLauncherApi: 'notification-service-enable-unity-dbus'
};

class LauncherApiService {

    /** @type {number} */
    #dbusId = null;

    /** @type {number} */
    #signalId = null;

    /** @type {() => void} */
    #callback = null;

    /** @type {Map<string, number>} */
    #notifications = new Map();

    /** @type {Map<string, number>} */
    get notifications() {
        return this.#notifications;
    }

    constructor() {
        this.#dbusId = Gio.DBus.session.own_name(
            DBUS_NAME,
            Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT | Gio.BusNameOwnerFlags.REPLACE,
            null, () => { this.#dbusId = null; }
        );
        this.#signalId = Gio.DBus.session.signal_subscribe(
            null, DBUS_SIGNAL_SOURCE, null, null, null, Gio.DBusSignalFlags.NONE,
            (_,__,___,____,_____, params) => this.#update(params)
        );
    }

    destroy() {
        this.disconnect();
        if (this.#dbusId) Gio.DBus.session.unown_name(this.#dbusId);
        if (this.#signalId) Gio.DBus.session.signal_unsubscribe(this.#signalId);
        this.#dbusId = null;
        this.#signalId = null;
        this.#notifications = null;
    }

    /**
     * @param {() => void} callback
     */
    connect(callback) {
        if (typeof this.#callback !== Type.Function) return;
        this.#callback = callback;
    }

    disconnect() {
        this.#callback = null;
    }

    /**
     * @param {GLib.Variant} params
     */
    #update(params) {
        if (!this.#notifications || !params) return;
        const [appUri, props] = params.deepUnpack();
        const appId = appUri?.replace(APPID_REGEXP_STRING, '');
        if (!appId || !props) return;
        const count = props[NOTIFICATIONS_COUNT_KEY]?.get_int64() ?? 0;
        const countVisible = props[NOTIFICATIONS_COUNT_VISIBLE_KEY]?.get_boolean() ?? false;
        if (count && countVisible) this.#notifications.set(appId, count);
        else if (!this.#notifications.has(appId)) return;
        else this.#notifications.delete(appId);
        if (typeof this.#callback === Type.Function) this.#callback();
    }

}

export class LauncherApiClient {

    /** @type {LauncherApiService} */
    #service = null;

    /** @type {Map<*, number>} */
    #clients = new Map();

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#handleConfig());

    /** @type {Map<string, number>} */
    get notifications() {
        return this.#service?.notifications;
    }

    constructor() {
        this.#handleConfig();
    }

    destroy() {
        if (!Context.isSessionLocked) {
            this.#service?.destroy();
            Context.getSessionCache(this.constructor.name).clear();
        } else this.#service?.disconnect();
        this.#service = null;
        this.#clients = null;
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connect(client, callback) {
        if (!this.#clients) return;
        if (typeof callback !== Type.Function || this.#clients.has(client)) return;
        this.#clients.set(client, callback);
    }

    /**
     * @param {*} client
     */
    disconnect(client) {
        if (!this.#clients) return;
        if (!this.#clients.has(client)) return;
        this.#clients.delete(client);
    }

    #handleConfig() {
        if (this.#config.enableLauncherApi && this.#service) return;
        const sessionCache = Context.getSessionCache(this.constructor.name);
        const service = sessionCache.get(LauncherApiService.name);
        if (!this.#config.enableLauncherApi) {
            if (service instanceof LauncherApiService) service.destroy();
            sessionCache.clear();
            this.#service = null;
            return;
        }
        this.#service = service;
        if (this.#service instanceof LauncherApiService === false) {
            this.#service = new LauncherApiService();
            sessionCache.set(LauncherApiService.name, this.#service);
        }
        this.#service.connect(() => this.#notifyClients());
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const [_, callback] of this.#clients) callback();
    }

}
