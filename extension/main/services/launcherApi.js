/**
 * @typedef {import('gi://GLib').Variant} GLib.Variant
 */

import Gio from 'gi://Gio';
import Context from '../core/context.js';
import { Config } from '../../shared/utils/config.js';

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
};

class LauncherApiService {

    /** @type {number?} */
    #dbusId = null;

    /** @type {number?} */
    #signalId = null;

    /** @type {((notifyType: LauncherApiNotify) => void)?} */
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
            null, () => {
                this.#dbusId = null;
            }
        );
        this.#signalId = Gio.DBus.session.signal_subscribe(
            null, DBUS_SIGNAL_SOURCE, null, null, null, Gio.DBusSignalFlags.NONE,
            (_, __, ___, ____, _____, params) => this.#update(params)
        );
    }

    destroy() {
        if (this.#dbusId) Gio.DBus.session.unown_name(this.#dbusId);
        if (this.#signalId) Gio.DBus.session.signal_unsubscribe(this.#signalId);
        this.#callback = null;
        this.#dbusId = null;
        this.#signalId = null;
    }

    /**
     * @param {(notifyType: LauncherApiNotify) => void} callback
     */
    connect(callback) {
        if (typeof callback !== 'function') return;
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
        /** @type {[appUri: string, props: {[key: string]: GLib.Variant}]} */
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
        if (typeof this.#callback === 'function') this.#callback(LauncherApiNotify.Notifications);
    }

    /**
     * @param {string} appId
     * @param {number} value
     */
    #handleProgress(appId, value) {
        value = Math.max(0, +parseFloat(`${value}`).toFixed(PROGRESS_VALUE_DECIMAL_PLACES) || 0);
        const oldValue = this.#progress.get(appId) ?? 0;
        if (value === oldValue || (value === 1 && !this.#progress.has(appId))) return;
        if (value) this.#progress.set(appId, value);
        else if (!this.#progress.has(appId)) return;
        else this.#progress.delete(appId);
        if (typeof this.#callback === 'function') this.#callback(LauncherApiNotify.Progress);
    }

}

export default class LauncherApiProxy {

    /** @type {LauncherApiService?} */
    static #service = null;

    /** @type {Map<*, () => void>?} */
    #notificationClients = new Map();

    /** @type {Map<*, () => void>?} */
    #progressClients = new Map();

    /** @type {Config} */
    #config = Config(this, ConfigFields, () => this.#handleConfig());

    /** @type {Map<string, number>?} */
    get notifications() {
        return LauncherApiProxy.#service?.notifications ?? null;
    }

    /** @type {Map<string, number>?} */
    get progress() {
        return LauncherApiProxy.#service?.progress ?? null;
    }

    constructor() {
        this.#handleConfig();
    }

    destroy() {
        LauncherApiProxy.#service?.disconnect();
        Context.signals.removeAll(this);
        this.#notificationClients?.clear();
        this.#progressClients?.clear();
        this.#notificationClients = null;
        this.#progressClients = null;
        if (Context.desktop.isLocked) return;
        LauncherApiProxy.#service?.destroy();
        LauncherApiProxy.#service = null;
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connectNotifications(client, callback) {
        if (!this.#notificationClients) return;
        if (typeof callback !== 'function' || this.#notificationClients.has(client)) return;
        this.#notificationClients.set(client, callback);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connectProgress(client, callback) {
        if (!this.#progressClients) return;
        if (typeof callback !== 'function' || this.#progressClients.has(client)) return;
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
        if (!this.#config.enableLauncherApi) {
            LauncherApiProxy.#service?.destroy();
            LauncherApiProxy.#service = null;
            return;
        }
        LauncherApiProxy.#service ??= new LauncherApiService();
        LauncherApiProxy.#service.connect(notifyType => this.#notifyClients(notifyType));
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
        const callbacks = clients.values();
        for (const callback of callbacks) callback();
    }

}
