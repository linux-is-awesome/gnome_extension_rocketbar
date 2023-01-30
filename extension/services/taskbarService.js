/* exported TaskbarClient */

import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { AppFavorites } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Type, Delay } from '../core/enums.js';
import { Config } from '../utils/config.js';

/** @enum {string} */
const ConfigFields = {
    enableFavorites: 'taskbar-show-favorites'
};

class Favorites {

    /** @type {AppFavorites.AppFavorites} */
    #favorites = AppFavorites.getAppFavorites();

    /** @type {Map<string, Shell.App>} */
    #apps = null;

    /** @type {() => void} */
    #callback = null;

    /** @type {Map<string, Shell.App>} */
    get apps() {
        if (this.#apps) return this.#apps;
        this.#apps = new Map();
        const appsById = this.#favorites.getFavoriteMap();
        for (const appId in appsById) this.#apps.set(appId, appsById[appId]);
        return this.#apps;
    }

    /**
     * @param {() => void} callback
     */
    constructor(callback) {
        if (typeof callback !== Type.Function) return;
        this.#callback = callback;
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), 'installed-changed', () => this.#handleInstalled()],
            [this.#favorites, 'changed', () => this.#handleChanged()]);
        this.#callback();
    }

    destroy() {
        Context.signals.removeAll(this);
        if (typeof this.#callback !== Type.Function) return;
        this.#callback();
        this.#callback = null;
    }

    /**
     * @param {Shell.App} app
     * @param {number} position
     */
    move(app, position) {
        if (app instanceof Shell.App === false || !app.id) return;
        const appIds = [...this.apps.keys()];
        const oldPosition = appIds.indexOf(app.id);
        if (position === oldPosition) return;
        this.#favorites.moveFavoriteToPos(app.id, position);
        this.#apps = null;
    }

    #handleChanged() {
        if (!this.#apps || typeof this.#callback !== Type.Function) return;
        this.#apps = null;
        this.#callback();
        console.log('Favorites: changed');
    }

    #handleInstalled() {
        if (typeof this.#callback !== Type.Function) return;
        const oldAppIds = this.#apps ? [...this.#apps.keys()].toString() : '';
        const newAppIds = this.#favorites._getIds().toString();
        if (oldAppIds === newAppIds) return;
        this.#apps = null;
        this.#callback();
        console.log('Favorites: installed changed');
    }

}

class TaskbarService {

    /** @type {Set<Meta.WindowType>} */
    #windowTypes = new Set([
        Meta.WindowType.NORMAL,
        Meta.WindowType.DIALOG,
        Meta.WindowType.MODAL_DIALOG
    ]);

    /** @type {Shell.WindowTracker} */
    #windowTracker = Shell.WindowTracker.get_default();

    /** @type {Meta.Workspace} */
    #workspace = null;

    /** @type {Favorites} */
    #favorites = null;

    /** @type {Map<Shell.App, Set<Meta.Window>>} */
    #apps = new Map(); // app => Set<window>

    /** @type {Map<Meta.Window, Shell.App>} */
    #windows = new Map(); // window => app

    /** @type {Set<Shell.App>} */
    #changedApps = new Set();

    /** @type {Set<TaskbarClient>} */
    #clients = new Set();

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, () => this.#handleConfig());

    /** @type {Job} */
    #notifyJob = Context.jobs.new(this);

    /** @type {Favorites|null} */
    get favorites() {
        return this.#favorites;
    }

    /** @type {Map<Shell.App, Set<Meta.Window>>} */
    get apps() {
        return this.#apps;
    }

    /** @type {Map<Meta.Window, Shell.App>} */
    get windows() {
        return this.#windows;
    }

    /** @type {boolean} */
    get wantsDestroy() {
        return !this.#clients.size;
    }

    constructor() {
        Context.jobs.new(this).destroy(() => this.#initialize());
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#workspace = null;
        this.#favorites?.destroy();
        this.#favorites = null;
        this.#apps = null;
        this.#windows = null;
        this.#notifyJob = null;
    }

    /**
     * @param {TaskbarClient} client
     */
    addClient(client) {
        if (!this.#clients || this.#clients.has(client)) return;
        this.#clients.add(client);
    }

    /**
     * @param {TaskbarClient} client
     */
    removeClient(client) {
        if (!this.#clients?.has(client)) return;
        this.#clients.delete(client);
    }

    #initialize() {
        this.#handleConfig();
        this.#addWindows();
        this.#handleWorkspace();
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), 'app-state-changed', (_, app) => this.#handleAppState(app)],
            [global.window_manager, 'switch-workspace', () => this.#handleWorkspace()]
        );
    }

    #handleConfig() {
        if (!this.#config.enableFavorites) {
            this.#favorites?.destroy();
            this.#favorites = null;
            return;
        }
        if (this.#favorites) return;
        this.#favorites = new Favorites(() => this.#trackAll(Delay.Queue));
    }

    #addWindows() {
        const windows = global.get_window_actors();
        if (!windows.length) return; 
        for (let i = 0, l = windows.length; i < l; ++i) {
            const window = windows[i].metaWindow;
            if (!this.#isValidWindow(window)) continue;
            this.#addWindow(window);
        }
    }

    #handleWorkspace() {
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        if (this.#workspace === currentWorkspace) return;
        Context.signals.remove(this, this.#workspace);
        this.#workspace = currentWorkspace;
        Context.signals.add(this, [
            this.#workspace,
            'window_added', (_, window) => this.#addWindowAsync(window), GObject.ConnectFlags.AFTER,
            'window_removed', (_, window) => this.#removeWindow(window), GObject.ConnectFlags.AFTER
        ]);
        this.#trackAll();
    }

    /**
     * @param {Shell.App} app
     */
    #handleAppState(app) {
        if (!this.#apps || app instanceof Shell.App === false) return;
        console.log('Handle app state', app?.id, app?.state);
        switch (app.state) {
            case Shell.AppState.STARTING: return;
            case Shell.AppState.RUNNING:
                if (this.#apps.has(app)) return;
                const windows = app.get_windows();
                if (!windows.length) return;
                this.#apps.set(app, new Set(windows));
                if (windows.length === 1) this.#windows.set(windows[0], app);
                else for (let i = 0, l = windows.length; i < l; ++i) this.#windows.set(windows[i], app);
                this.#trackApp(app);
                console.log('Add App', app?.id, app?.state, windows.length);
                return;
            default: if (!this.#apps.has(app)) return;
        }
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows.size || !this.#windows.size) return this.#trackApp(app);
        for (const window of windows) this.#windows.delete(window);
        this.#trackApp(app);
        console.log('Remove App', app?.id, app?.state, windows.size);
    }

    /**
     * Async execution is required in order to extract an app from the window
     * Connecting signals using GObject.ConnectFlags.AFTER isn't really helpful in this case
     * 
     * @param {Meta.Window} window
     */
    #addWindowAsync(window) {
        if (!this.#isValidWindow(window)) return;
        Context.jobs.new(window).destroy(() => this.#trackApp(this.#addWindow(window)));
    }

    /**
     * @param {Meta.Window} window
     */
    #addWindow(window) {
        if (!this.#windows || this.#windows.has(window)) return null;
        const app = this.#windowTracker?.get_window_app(window);
        if (typeof app?.id !== Type.String) return null;
        this.#windows.set(window, app);
        if (!this.#apps.has(app)) this.#apps.set(app, new Set([window]));
        else this.#apps.get(app).add(window);
        console.log('Add App WINDOW', app?.id, app?.state, window.title);
        return app;
    }

    /**
     * @param {Meta.Window} window
     */
    #removeWindow(window) {
        if (!this.#isValidWindow(window)) return;
        Context.jobs.removeAll(window);
        if (!this.#windows.has(window)) return;
        const app = this.#windows.get(window);
        this.#windows.delete(window);
        if (!this.#apps?.has(app)) return;
        const windows = this.#apps.get(app);
        windows.delete(window);
        if (!windows.size) this.#apps.delete(app);
        this.#trackApp(app);
    }

    /**
     * @param {Meta.Window} window
     */
    #isValidWindow(window) {
        return window instanceof Meta.Window && this.#windowTypes?.has(window.get_window_type());
    }

    /**
     * @param {number} [delay]
     */
    #trackAll(delay = Delay.Idle) {
        if (!this.#workspace) return;
        this.#changedApps.clear();
        this.#notifyJob?.reset(delay).then(() => this.#notifyClients());
    }

    /**
     * @param {Shell.App} app
     */
    #trackApp(app) {
        if (!this.#workspace || !app || this.#changedApps.has(app)) return;
        this.#changedApps.add(app);
        this.#notifyJob?.reset(Delay.Queue).then(() => this.#notifyClients());
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const client of this.#clients) client.notify(this.#changedApps);
        this.#changedApps.clear();
    }

}

export class TaskbarClient {

    /** @type {TaskbarService} */
    static #service = null;

    #app = null;

    /** @type {(apps: Set<Shell.App>|null) => void} */
    #callback = null;

    /** @type {Favorites|null} */
    get favorites() {
        return TaskbarClient.#service?.favorites;
    }

    /**
     * @param {(apps: Set<Shell.App>|null) => void} callback
     * @param {Shell.App} app
     */
    constructor(callback, app) {
        if (typeof callback !== Type.Function) return;
        this.#callback = callback;
        if (app instanceof Shell.App) {
            this.#app = app;
        }
        if (!TaskbarClient.#service) {
            TaskbarClient.#service = new AppService();
        }
        TaskbarClient.#service.addClient(this);
        this.#service.addClient(this);
    }

    destroy() {
        this.#callback = null;
        this.#app = null;
        if (!this.#service) return;
        TaskbarClient.#service?.removeClient(this);
        if (!TaskbarClient.#service?.wantsDestroy) return;
        TaskbarClient.#service.destroy();
        TaskbarClient.#service = null;
    }

    /**
     * @param {*} filters
     * @returns {Set<Meta.Window>|Map<Shell.App, Set<Meta.Window>>}
     */
    getWindows(filters) {
        if (!TaskbarClient.#service) return null;
        if (this.#app) return TaskbarClient.#service.apps.get(this.#app);
        return TaskbarClient.#service.apps;
    }

    /**
     * @param {Set<Shell.App>} apps
     */
    notify(apps) {
        if (typeof this.#callback !== Type.Function) return;
        if (!this.#app) this.#callback(apps); 
        else if (!apps || apps.has(this.#app)) this.#callback();
    }

}
