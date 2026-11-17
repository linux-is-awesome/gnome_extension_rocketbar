import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Context from '../core/context.js';
import { MetadataField } from '../enums/general.js';

const DBUS_ENDPOINT_REGEXP = /[^A-Za-z0-9_]/g;
const DBUS_BASE_PATH = 'org.gnome.Shell.Extensions';
const DBUS_INTERFACE = `${DBUS_BASE_PATH}.Rocketbar.NavigationApi`;
const DBUS_SIGNAL = 'Navigate';
const DBUS_PARAMS_SIGNATURE = '(sa{sv})';
const DBUS_CLIENT_WAIT_TIMEOUT = 5000;

/**
 * @param {string} uuid
 * @returns {{name: string, path: string}}
 */
const Api = uuid => {
    const endpoint = uuid.replace(DBUS_ENDPOINT_REGEXP, '_');
    const name = `${DBUS_BASE_PATH}.${endpoint}`;
    const path = `/${DBUS_BASE_PATH.replaceAll('.', '/')}/${endpoint}`;
    return { name, path };
};

/**
 * @param {*} value
 * @returns {GLib.Variant?}
 */
const GLibVariantValue = value => {
    const valueType = typeof value;
    switch (valueType) {
        case 'string':
            return GLib.Variant.new_string(value);
        case 'boolean':
            return GLib.Variant.new_boolean(value);
        case 'number':
            return Number.isInteger(value) ?
                   GLib.Variant.new_int32(value) :
                   GLib.Variant.new_double(value);
    }
    return null;
};

class NavigationApi {

    /** @type {((page: string, params: {[field: string]: *}) => void)?} */
    #callback = null;

    /** @type {number?} */
    #dbusId = null;

    /** @type {number?} */
    #signalId = null;

    /**
     * @param {string} uuid
     * @param {(page: string, params: {[field: string]: *}) => void} callback
     */
    constructor(uuid, callback) {
        if (!uuid || typeof uuid !== 'string') return;
        const { name, path } = Api(uuid);
        this.#callback = callback;
        this.#dbusId = Gio.DBus.session.own_name(
            name, Gio.BusNameOwnerFlags.NONE, null, () => this.destroy());
        this.#signalId = Gio.DBus.session.signal_subscribe(
            null, DBUS_INTERFACE, DBUS_SIGNAL, path, null, Gio.DBusSignalFlags.NONE,
            (_, __, ___, ____, _____, data) => this.#handleSignal(data));
    }

    destroy() {
        if (this.#signalId) Gio.DBus.session.signal_unsubscribe(this.#signalId);
        if (this.#dbusId) Gio.DBus.session.unown_name(this.#dbusId);
        this.#signalId = null;
        this.#dbusId = null;
        this.#callback = null;
    }

    /**
     * @param {GLib.Variant} data
     */
    #handleSignal(data) {
        if (!data || typeof this.#callback !== 'function') return;
        const [page = null, params = {}] = data.deepUnpack();
        if (!page) return;
        this.#callback(page, params);
    }

}

export class NavigationApiService {

    /** @type {NavigationApi?} */
    static #api = null;

    /**
     * @param {(page: string, params: {[field: string]: *}) => void} callback
     */
    constructor(callback) {
        const uuid = Context.metadata?.[MetadataField.Uuid];
        if (!uuid || typeof uuid !== 'string' || typeof callback !== 'function') return;
        NavigationApiService.#api ??= new NavigationApi(uuid, callback);
    }

    destroy() {
        NavigationApiService.#api?.destroy();
        NavigationApiService.#api = null;
    }

}

export class NavigationApiClient {

    /** @type {string?} */
    #uuid = null;

    /** @type {(() => void)?} */
    #navigationCallback = null;

    /** @type {number?} */
    #watcherId = null;

    /** @type {{page: string, params: {[field: string]: *}}?} */
    #payload = null;

    /**
     * @param {(() => void)?} [navigationCallback]
     */
    constructor(navigationCallback) {
        const uuid = Context.metadata?.[MetadataField.Uuid] ?? null;
        this.#uuid = typeof uuid === 'string' ? uuid : null;
        this.#navigationCallback = navigationCallback ?? null;
    }

    destroy() {
        this.#cancel();
        this.#navigationCallback = null;
        this.#uuid = null;
    }

    /**
     * @param {string} page
     * @param {{[field: string]: *}} [params]
     */
    navigate(page, params = {}) {
        this.#cancel();
        if (!page || typeof page !== 'string' || !this.#uuid) return;
        try {
            const { name } = Api(this.#uuid);
            this.#payload = { page, params };
            this.#watcherId = Gio.bus_watch_name(
                Gio.BusType.SESSION, name, Gio.BusNameWatcherFlags.NONE,
                () => this.#emit(), null);
            Context.jobs.new(this, DBUS_CLIENT_WAIT_TIMEOUT).destroy(() => this.#cancel());
            if (typeof this.#navigationCallback !== 'function') return;
            this.#navigationCallback();
        } catch (e) {
            this.#cancel();
            Context.logError(`${this.constructor.name} failed to start navigation.`, e);
        }
    }

    #emit() {
        if (!this.#payload || !this.#uuid) return;
        const { page, params } = this.#payload;
        this.#cancel();
        try {
            const { name, path } = Api(this.#uuid);
            const dbusParams = [page, this.#packParams(params)];
            Gio.DBus.session.emit_signal(
                name, path, DBUS_INTERFACE, DBUS_SIGNAL,
                new GLib.Variant(DBUS_PARAMS_SIGNATURE, dbusParams));
        } catch (e) {
            Context.logError(`${this.constructor.name} failed to emit dbus signal.`, e);
        }
    }

    #cancel() {
        Context.jobs.removeAll(this);
        if (this.#watcherId) Gio.bus_unwatch_name(this.#watcherId);
        this.#watcherId = null;
        this.#payload = null;
    }

    /**
     * @param {{[field: string]: *}} params
     * @returns {{[key: string]: GLib.Variant}}
     */
    #packParams(params) {
        /** @type {{[key: string]: GLib.Variant}} */
        const result = {};
        for (const key in params) {
            const resultValue = GLibVariantValue(params[key]);
            if (!resultValue) continue;
            result[key] = resultValue;
        }
        return result;
    }

}
