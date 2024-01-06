import St from 'gi://St';
import { sessionMode as UserSession,
         layoutManager as MainLayout } from 'resource:///org/gnome/shell/ui/main.js';
import Jobs from './context/jobs.js';
import Signals from './context/signals.js';
import LayoutManager from './context/layout.js';
import Modules from './context/modules.js';
import { LauncherApiProxy } from '../services/launcherApiService.js';
import { SessionMode } from './enums.js';

const SETTINGS_SCHEMA_KEY = 'settings-schema';

export default class Context {

    /** @type {Context} */
    static #instance = null;

    /** @type {Map<*, Map>} a persistent cache to keep some data until the user's session ends or the extension gets disabled by the user */
    static #sessionStorage = null;

    /** @type {Context} */
    static get instance() {
        if (!this.#instance) new Error(`${this.name} has no instance.`);
        return this.#instance;
    }

    /** @type {Object.<string, *>} */
    static get metadata() {
        return this.instance.#extension?.metadata;
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

    /** @type {LayoutManager} */
    static get layout() {
        const instance = this.instance;
        instance.#layoutManager ??= new LayoutManager();
        return instance.#layoutManager;
    }

    /** @type {LauncherApiProxy} */
    static get launcherApi() {
        return this.instance.#launcherApi;
    }

    /** @type {St.IconTheme} */
    static get iconTheme() {
        return this.instance.#iconTheme;
    }

    /** @type {boolean} */
    static get isSessionLocked() {
        return UserSession.currentMode === SessionMode.Locksreen ||
               MainLayout.screenShieldGroup?.visible;
    }

    /**
     * @param {string} [path]
     * @returns {Gio.Settings}
     */
    static getSettings(path) {
        try {
            const extension = this.instance.#extension;
            if (!extension) return null;
            const schemaId = path ? `${extension.metadata[SETTINGS_SCHEMA_KEY]}.${path}` : null;
            const storage = this.getStorage(this.name);
            if (storage.has(schemaId)) return storage.get(schemaId);
            const settings = extension.getSettings(schemaId);
            storage.set(schemaId, settings);
            return settings;
        } catch (e) {
            this.logError(`unable to load settings for the id ${schemaId}`);
        }
        return null;
    }

    /**
     * @param {*} client
     * @returns {Map}
     */
    static getStorage(client) {
        if (!client) return null;
        this.#sessionStorage ??= new Map();
        if (!this.#sessionStorage.has(client)) this.#sessionStorage.set(client, new Map());
        return this.#sessionStorage.get(client);
    }

    /**
     * @param {string} [message]
     * @param {Error} [error]
     */
    static logError(message, error) {
        console.error(`${this.metadata?.name ?? this.name} ${message ?? ''}`, error ?? '');
    }

    /**
     * @typedef {import('../extension.js').default} Extension
     * @type {Extension}
     */
    #extension = null;

    /** @type {Jobs} */
    #jobs = null;

    /** @type {Signals} */
    #signals = null;

    /** @type {LayoutManager} */
    #layoutManager = null;

    /** @type {Modules} */
    #modules = null;

    /** @type {LauncherApiProxy} */
    #launcherApi = null;

    /** @type {St.IconTheme} */
    #iconTheme = new St.IconTheme();

    /**
     * @param {Extension} extension
     */
    constructor(extension) {
        if (Context.#instance) throw new Error(`${Context.name} already has an instance.`);
        if (!extension) throw new Error(`${Context.name} requires an instance of the extension class.`);
        Context.#instance = this;
        this.#extension = extension;
        this.#launcherApi = new LauncherApiProxy();
        this.#modules = new Modules();
        console.log('Context created');
    }

    /**
     * TODO: Uncomment the first line of the function to allow the extension to work on lockscreen.
     *       I think there is no way to pass the review with the uncommented line, so need to think about the solution later.
     */
    destroy() {
        // if (Context.isSessionLocked) throw new Error(`${Context.name} destroy prevented.`);
        try {
            this.#destroy();
        } catch (e) {
            Context.logError(`unable to destroy ${Context.name}.`, e);
        } finally {
            this.#extension = null;
            Context.#instance = null;
        }
        console.log('Context destroyed');
    }

    #destroy() {
        this.#modules?.destroy();
        this.#modules = null;
        this.#layoutManager?.destroy();
        this.#layoutManager = null;
        this.#jobs?.destroy();
        this.#jobs = null;
        this.#signals?.destroy();``
        this.#signals = null;
        this.#launcherApi?.destroy();
        this.#launcherApi = null;
        this.#iconTheme = null;
        this.#cleanSessionStorage();
    }

    /**
     * Note: Removes all data from the storage if the extension gets disabled by the user.
     *       But keeps it if the Shell disables the extension in order restore the data later.
     */
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
        console.log('Session storage removed');
        Context.#sessionStorage = null;
    }

}
