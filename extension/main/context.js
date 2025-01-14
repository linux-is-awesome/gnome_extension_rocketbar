/**
 * @typedef {import('gi://Gio').Settings} Gio.Settings
 * @typedef {import('resource:///org/gnome/shell/extensions/extension.js').Extension} Extension
 */

import St from 'gi://St';
import { Session, MainLayout } from './shell.js';
import { SessionMode } from '../shared/enums.js';
import Jobs from './context/jobs.js';
import Signals from './context/signals.js';
import Desktop from './context/desktop.js';
import Modules from '../services/modules.js';
import LauncherApi from '../services/launcherApi.js';

const SETTINGS_SCHEMA_KEY = 'settings-schema';

export default class Context {

    /** @type {Context?} */
    static #instance = null;

    /** @type {Map<*, Map>?} a persistent cache to keep some data until the user's session ends or the extension gets disabled by the user */
    static #sessionStorage = null;

    /** @type {Context} */
    static get instance() {
        if (!this.#instance) throw new Error(`${this.name} has no instance.`);
        return this.#instance;
    }

    /** @type {{[key: string]: *}?} */
    static get metadata() {
        return this.instance.#extension?.metadata;
    }

    /** @type {string?} */
    static get path() {
        return this.instance.#extension?.path ?? null;
    }

    /** @type {Jobs} */
    static get jobs() {
        const instance = this.instance;
        instance.#jobs ??= new Jobs();
        return instance.#jobs;
    }

    /** @type {Signals} */
    static get signals() {
        const instance = this.instance;
        instance.#signals ??= new Signals();
        return instance.#signals;
    }

    /** @type {Desktop} */
    static get desktop() {
        const instance = this.instance;
        instance.#desktop ??= new Desktop();
        return instance.#desktop;
    }

    /** @type {St.IconTheme} */
    static get iconTheme() {
        const instance = this.instance;
        instance.#iconTheme ??= new St.IconTheme();
        return instance.#iconTheme;
    }

    /** @type {St.Settings} */
    static get systemSettings() {
        const instance = this.instance;
        instance.#systemSettings ??= St.Settings.get();
        return instance.#systemSettings;
    }

    /** @type {LauncherApi?} */
    static get launcherApi() {
        return this.instance.#launcherApi;
    }

    /** @type {boolean} */
    static get isSessionLocked() {
        return Session.currentMode === SessionMode.Locksreen ||
               MainLayout.screenShieldGroup?.visible === true;
    }

    /**
     * @param {string?} [path]
     * @returns {Gio.Settings?}
     */
    static getSettings(path) {
        try {
            const extension = this.instance.#extension;
            if (!extension) return null;
            const schemaId = path ? `${extension.metadata[SETTINGS_SCHEMA_KEY]}.${path}` : '';
            const storage = this.getStorage(this.name);
            if (storage.has(schemaId)) return storage.get(schemaId);
            const settings = extension.getSettings(schemaId);
            storage.set(schemaId, settings);
            return settings;
        } catch (e) {
            this.logError(`unable to load settings for the path ${path}.`);
        }
        return null;
    }

    /**
     * @param {*} client
     * @returns {Map}
     */
    static getStorage(client) {
        if (!this.#instance) throw new Error(`${this.name} is invalid.`);
        if (!client) throw new Error(`${this.name}.getStorage requires a client reference.`);
        this.#sessionStorage ??= new Map();
        const clientStorage = this.#sessionStorage.get(client) ?? new Map();
        this.#sessionStorage.set(client, clientStorage);
        return clientStorage;
    }

    /**
     * @param {string?} [message]
     * @param {*} [error]
     */
    static logError(message, error) {
        console.error(`${this.metadata?.name ?? this.name} ${message ?? ''}`, error ?? '');
    }

    /** @type {Extension?} */
    #extension = null;

    /** @type {Jobs?} */
    #jobs = null;

    /** @type {Signals?} */
    #signals = null;

    /** @type {Desktop?} */
    #desktop = null;

    /** @type {Modules?} */
    #modules = null;

    /** @type {LauncherApi?} */
    #launcherApi = null;

    /** @type {St.IconTheme?} */
    #iconTheme = null;

    /** @type {St.Settings?} */
    #systemSettings = null;

    /**
     * @param {Extension} extension
     */
    constructor(extension) {
        if (Context.#instance) throw new Error(`${Context.name} already has an instance.`);
        if (!extension) throw new Error(`${Context.name} requires an instance of the extension class.`);
        this.#extension = extension;
        Context.#instance = this;
        if (!Context.isSessionLocked) this.#initialize();
        else Context.jobs.new(this).destroy(() => this.#initialize());
    }

    destroy() {
        try {
            this.#destroy();
        } catch (e) {
            Context.logError(`unable to destroy ${Context.name}.`, e);
        } finally {
            this.#modules = null;
            this.#desktop = null;
            this.#jobs = null;
            this.#signals = null;
            this.#launcherApi = null;
            this.#iconTheme = null;
            this.#systemSettings = null;
            this.#extension = null;
            Context.#instance = null;
        }
    }

    #initialize() {
        this.#launcherApi = new LauncherApi();
        this.#modules = new Modules();
    }

    #destroy() {
        this.#jobs?.removeAll(this);
        this.#modules?.destroy();
        this.#desktop?.destroy();
        this.#jobs?.destroy();
        this.#signals?.destroy();
        this.#launcherApi?.destroy();
        this.#cleanSessionStorage();
    }

    #cleanSessionStorage() {
        const sessionStorage = Context.#sessionStorage;
        if (!sessionStorage) return;
        if (!Context.isSessionLocked) {
            sessionStorage.clear();
            Context.#sessionStorage = null;
            return;
        }
        sessionStorage.delete(Context.name);
        const clients = [...sessionStorage.keys()];
        for (let i = 0, l = clients.length; i < l; ++i) {
            const client = clients[i];
            if (sessionStorage.get(client)?.size) continue;
            sessionStorage.delete(client);
        }
        if (sessionStorage.size) return;
        Context.#sessionStorage = null;
    }

}
