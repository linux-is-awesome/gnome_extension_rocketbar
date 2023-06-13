/* exported LauncherApiClient */

import Gio from 'gi://Gio';
import { Context } from '../core/context.js';
import { Type } from '../core/enums.js';
import { Config } from '../utils/config.js';

const DBUS_NAME = 'com.canonical.Unity';
const DBUS_SIGNAL_SOURCE = 'com.canonical.Unity.LauncherEntry';
const LAUNCHER_ENTRY_COUNT_KEY = 'count';
const LAUNCHER_ENTRY_PROGRESS_KEY = 'progress';
const APPID_REGEXP_STRING = /(^\w+:|^)\/\/|(.desktop)/g;
const PROGRESS_VALUE_DECIMAL_PLACES = 2;

/** @enum {string} */
const ConfigFields = {
    enableLauncherApi: 'notification-service-enable-unity-dbus'
};

/** @enum {string} */
const LauncherApiNotify = {
    Notifications: 'notifications',
    Progress: 'progress'
}

class LauncherApiService {

    /** @type {number} */
    #dbusId = null;

    /** @type {number} */
    #signalId = null;

    /** @type {(notifyType: LauncherApiNotify) => void} */
    #callback = null;

    /** @type {Map<string, number>} */
    #notifications = new Map();

    /** @type {Map<string, number>} */
    #progress = new Map();

    /** @type {Map<string, number>} */
    get notifications() {
        return this.#notifications;
    }

    /** @type {Map<string, number>} */
    get progress() {
        return this.#progress;
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
     * @param {(notifyType: LauncherApiNotify) => void} callback
     */
    connect(callback) {
        if (typeof callback !== Type.Function) return;
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
        const count = props[LAUNCHER_ENTRY_COUNT_KEY]?.get_int64() ?? 0;
        const progress = props[LAUNCHER_ENTRY_PROGRESS_KEY]?.get_double() ?? 0;
        this.#handleNotifications(appId, count);
        this.#handleProgress(appId, progress);
    }

    /**
     * @param {string} appId
     * @param {number} count
     */
    #handleNotifications(appId, count) {
        if (count) this.#notifications.set(appId, count);
        else if (!this.#notifications.has(appId)) return;
        else this.#notifications.delete(appId);
        if (typeof this.#callback === Type.Function) this.#callback(LauncherApiNotify.Notifications);
    }

    /**
     * @param {string} appId
     * @param {number} value
     */
    #handleProgress(appId, value) {
        value = +parseFloat(value).toFixed(PROGRESS_VALUE_DECIMAL_PLACES) || 0;
        const oldValue = this.#progress.get(appId) ?? 0;
        if (value === oldValue || (value === 1 && !this.#progress.has(appId))) return;
        if (value) this.#progress.set(appId, value);
        else if (!this.#progress.has(appId)) return;
        else this.#progress.delete(appId);
        if (typeof this.#callback === Type.Function) this.#callback(LauncherApiNotify.Progress);
    }

}

export class LauncherApiClient {

    /** @type {LauncherApiService} */
    #service = null;

    /** @type {Map<*, () => void>} */
    #notificationClients = new Map();

    /** @type {Map<*, () => void>} */
    #progressClients = new Map();

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#handleConfig());

    /** @type {Map<string, number>} */
    get notifications() {
        return this.#service?.notifications;
    }

    /** @type {Map<string, number>} */
    get progress() {
        return this.#service?.progress;
    }

    constructor() {
        this.#handleConfig();
    }

    destroy() {
        if (!Context.isSessionLocked) {
            this.#service?.destroy();
            Context.getSessionCache(this.constructor.name).clear();
        } else this.#service?.disconnect();
        Context.signals.removeAll(this);
        this.#service = null;
        this.#notificationClients = null;
        this.#progressClients = null;
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connectNotifications(client, callback) {
        if (!this.#notificationClients) return;
        if (typeof callback !== Type.Function || this.#notificationClients.has(client)) return;
        this.#notificationClients.set(client, callback);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connectProgress(client, callback) {
        if (!this.#progressClients) return;
        if (typeof callback !== Type.Function || this.#progressClients.has(client)) return;
        this.#progressClients.set(client, callback);
    }

    /**
     * @param {*} client
     */
    disconnect(client) {
        if (this.#notificationClients?.has(client)) this.#notificationClients.delete(client);
        if (this.#progressClients?.has(client)) this.#progressClients.delete(client);
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
        this.#service.connect(notifyType => this.#notifyClients(notifyType));
    }

    /**
     * @param {LauncherApiNotify} notifyType
     */
    #notifyClients(notifyType) {
        let clients = null;
        switch (notifyType) {
            case LauncherApiNotify.Notifications:
                clients = this.#notificationClients;
                break;
            case LauncherApiNotify.Progress:
                clients = this.#progressClients;
                break;
        }
        if (!clients?.size) return;
        for (const [_, callback] of clients) callback();
    }

}
