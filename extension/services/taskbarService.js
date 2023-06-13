/* exported TaskbarClient */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { AppFavorites } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Event, Type, Delay } from '../core/enums.js';
import { Config } from '../utils/config.js';

/** @enum {string} */
const ConfigFields = {
    enableFavorites: 'taskbar-show-favorites'
};

class Favorites {

    /** @type {AppFavorites.AppFavorites} */
    #favorites = AppFavorites.getAppFavorites();

    /** @type {Set<Shell.App>} */
    #apps = null;

    /** @type {Map<string, Shell.App>} */
    #appsById = null;

    /** @type {() => void} */
    #callback = null;

    /** @type {Map<string, Shell.App>} */
    get appsById() {
        if (this.#appsById) return this.#appsById;
        this.#appsById = new Map();
        const appsById = this.#favorites.getFavoriteMap();
        for (const appId in appsById) this.#appsById.set(appId, appsById[appId]);
        return this.#appsById;
    }

    /** @type {Set<Shell.App>} */
    get apps() {
        if (this.#appsById && this.#apps) return this.#apps;
        this.#apps = new Set(this.appsById.values());
        return this.#apps;
    }

    /**
     * @param {() => void} callback
     */
    constructor(callback) {
        if (typeof callback !== Type.Function) return;
        this.#callback = callback;
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.InstalledAppsChanged, () => this.#handleInstalled()],
            [this.#favorites, Event.FavoritesChanged, () => this.#handleChanged()]);
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
     * @param {number} [position]
     */
    add(app, position = -1) {
        if (app instanceof Shell.App === false || !app.id) return;
        const oldPosition = [...this.appsById.keys()].indexOf(app.id);
        if (position === oldPosition) return;
        if (oldPosition < 0) this.#favorites.addFavoriteAtPos(app.id, position);
        else this.#favorites.moveFavoriteToPos(app.id, position);
    }

    /**
     * @param {Shell.App} app
     * @returns {boolean}
     */
    canAdd(app) {
        if (app instanceof Shell.App === false || !app.id || !app.app_info) return false;
        const validationFunction = this.#favorites?._parentalControlsManager?.shouldShowApp;
        if (typeof validationFunction !== Type.Function) return false;
        return validationFunction(app.app_info);
    }

    /**
     * @param {Shell.App} app
     */
    remove(app) {
        if (app instanceof Shell.App === false || !app.id) return;
        this.#favorites.removeFavorite(app.id);
    }

    #handleChanged() {
        if (!this.#appsById || typeof this.#callback !== Type.Function) return;
        this.#appsById = null;
        this.#callback();
    }

    #handleInstalled() {
        if (typeof this.#callback !== Type.Function) return;
        const oldAppIds = `${this.#appsById ? [...this.#appsById.keys()] : []}`;
        const newAppIds = `${this.#favorites._getIds()}`;
        if (oldAppIds === newAppIds) return;
        this.#appsById = null;
        this.#callback();
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
    #oldWorkspace = null;

    /** @type {Meta.Workspace} */
    #workspace = null;

    /** @type {Favorites} */
    #favorites = null;

    /** @type {Map<Shell.App, Set<Meta.Window>>} */
    #apps = new Map();

    /** @type {Map<Meta.Window, Shell.App>} */
    #windows = Context.getSessionCache(this.constructor.name);

    /** @type {Set<Shell.App>} */
    #trackedApps = new Set();

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

    /** @type {Meta.Workspace} */
    get workspace() {
        return this.#workspace;
    }

    /** @type {Set<Shell.App>} */
    get trackedApps() {
        return this.#trackedApps;
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return this.#oldWorkspace !== this.#workspace;
    }

    constructor() {
        Context.jobs.new(this).destroy(() => this.#initialize()).catch();
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#clients?.size) return false;
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#workspace = null;
        this.#favorites?.destroy();
        this.#favorites = null;
        this.#apps = null;
        this.#windows = null;
        this.#clients = null;
        return true;
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

    /**
     * @param {Meta.Window} window
     * @returns {boolean}
     */
    isValidWindow(window) {
        return this.#isValidWindow(window);
    }

    #initialize() {
        this.#handleConfig();
        this.#addWindows();
        this.#handleWorkspace();
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.AppStateChanged, (_, app) => this.#handleAppState(app)],
            [global.window_manager, Event.SwitchWorkspace, () => this.#handleWorkspace()]
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
        if (!windows.length) return this.#windows.clear();
        const oldWindows = this.#windows.size ? [...this.#windows.keys()] : null;
        const newWindows = new Set();
        for (let i = 0, l = windows.length; i < l; ++i) {
            const window = windows[i].metaWindow;
            if (!this.#isValidWindow(window)) continue;
            if (oldWindows) newWindows.add(window);
            this.#addWindow(window, false);
        }
        if (!oldWindows) return;
        if (!newWindows.size) return this.#windows.clear();
        for (let i = 0, l = oldWindows.length; i < l; ++i) {
            const window = oldWindows[i];
            if (!newWindows.has(window)) {
                this.#windows.delete(window);
                continue;
            }
            this.#addAppWindow(this.#windows.get(window), window);
        }
    }

    #handleWorkspace() {
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        if (this.#workspace === currentWorkspace) return;
        Context.signals.remove(this, this.#workspace);
        this.#oldWorkspace = this.#workspace;
        this.#workspace = currentWorkspace;
        Context.signals.add(this, [
            this.#workspace,
            Event.WindowAdded, (_, window) => this.#addWindowAsync(window), GObject.ConnectFlags.AFTER,
            Event.WindowRemoved, (_, window) => this.#removeWindowAsync(window), GObject.ConnectFlags.AFTER
        ]);
        if (!this.#oldWorkspace) return this.#trackAll();
        const workspaceWindows = this.#workspace.list_windows();
        if (!workspaceWindows.length) return this.#trackAll();
        for (let i = 0, l = workspaceWindows.length; i < l; ++i) {
            const window = workspaceWindows[i];
            if (!this.#isValidWindow(window)) continue;
            this.#addWindow(window, false);
        }
        this.#trackAll();
    }

    /**
     * @param {Shell.App} app
     */
    #handleAppState(app) {
        if (!this.#apps || app instanceof Shell.App === false) return;
        switch (app.state) {
            case Shell.AppState.STARTING: return;
            case Shell.AppState.RUNNING:
                if (this.#apps.has(app)) return;
                const windows = app.get_windows();
                if (!windows.length) return;
                this.#apps.set(app, new Set(windows));
                if (windows.length === 1) this.#windows.set(windows[0], app);
                else for (let i = 0, l = windows.length; i < l; ++i) this.#windows.set(windows[i], app);
                return this.#trackApp(app);
            default: if (!this.#apps.has(app)) return;
        }
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows.size || !this.#windows.size) return this.#trackApp(app);
        for (const window of windows) this.#windows.delete(window);
        this.#trackApp(app);
    }

    /**
     * Note: Async execution is required in order to extract an app from the window.
     *       Connecting signals using GObject.ConnectFlags.AFTER isn't really helpful in this case.
     * 
     * @param {Meta.Window} window
     */
    #addWindowAsync(window) {
        if (!this.#windows || !this.#isValidWindow(window)) return;
        if (this.#windows.has(window)) return this.#trackApp(this.#windows.get(window));
        Context.jobs.new(window).destroy(() => this.#addWindow(window)).catch();
    }

    /**
     * @param {Meta.Window} window
     * @param {boolean} [track]
     */
    #addWindow(window, track = true) {
        if (!this.#windows || this.#windows.has(window)) return;
        const app = this.#windowTracker?.get_window_app(window);
        if (typeof app?.id !== Type.String) return;
        this.#windows.set(window, app);
        this.#addAppWindow(app, window);
        if (track) this.#trackApp(app);
    }

    /**
     * @param {Shell.App} app
     * @param {Meta.Window} window
     */
    #addAppWindow(app, window) {
        if (!this.#apps.has(app)) this.#apps.set(app, new Set([window]));
        else this.#apps.get(app).add(window);
    }

    /**
     * Note: Async execution is required in order to check existing app windows.
     * 
     * @param {Meta.Window} window
     */
    #removeWindowAsync(window) {
        if (!this.#windows || !this.#isValidWindow(window)) return;
        Context.jobs.removeAll(window);
        if (!this.#windows.has(window)) return;
        Context.jobs.new(window).destroy(() => this.#removeWindow(window)).catch();
    }

    /**
     * @param {Meta.Window} window
     */
    #removeWindow(window) {
        if (!this.#windows?.has(window)) return;
        const app = this.#windows.get(window);
        const appWindows = new WeakSet(app.get_windows() ?? []);
        if (appWindows.has(window)) return this.#trackApp(app);
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
        return window instanceof Meta.Window && this.#windowTypes.has(window.get_window_type());
    }

    /**
     * @param {number} [delay]
     */
    #trackAll(delay = Delay.Idle) {
        if (!this.#workspace) return;
        this.#trackedApps = null;
        this.#resetJob(delay);
    }

    /**
     * @param {Shell.App} app
     */
    #trackApp(app) {
        if (!this.#workspace || !app || !this.#trackedApps ||
            this.#trackedApps.has(app)) return;
        this.#trackedApps.add(app);
        this.#resetJob(Delay.Queue);
    }

    /**
     * @param {number} [delay]
     */
    #resetJob(delay = Delay.Idle) {
        this.#notifyJob.reset(delay).then(() => this.#notifyClients()).catch();
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        const clients = [...this.#clients];
        for (let i = 0, l = clients.length; i < l; ++i) clients[i].triggerNotify(this.#trackedApps);
        if (this.#trackedApps) this.#trackedApps.clear();
        else this.#trackedApps = new Set();
        this.#oldWorkspace = this.#workspace;
    }

}

export class TaskbarClient {

    /** @type {TaskbarService} */
    static #service = null;

    /** @type {{window: Meta.Window, app: Shell.App}} */
    static #focusedWindow = null;

    /** @type {Shell.App} */
    #app = null;

    /** @type {() => void} */
    #callback = null;

    /** @type {Meta.Workspace} */
    #workspace = null;

    /** @type {Favorites|null} */
    get favorites() {
        return TaskbarClient.#service?.favorites;
    }

    /** @type {Meta.Workspace} */
    get workspace() {
        return TaskbarClient.#service?.workspace;
    }

    /** @type {boolean} */
    get isPending() {
        return this.#app && TaskbarClient.#service?.trackedApps?.has(this.#app);
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return TaskbarClient.#service?.isWorkspaceChanged;
    }

    /** @type {boolean} */
    get hasFocusedWindow() {
        if (!TaskbarClient.#service || !this.#app ||
            this.#app.state === Shell.AppState.STOPPED) return false;
        const current = global.display.focus_window;
        const old = TaskbarClient.#focusedWindow;
        if (!current && !old) return false;
        if (!current && old) {
            if (old.window.minimized || !old.window.get_pid() ||
                global.stage.get_key_focus() instanceof Clutter.Actor) {
                TaskbarClient.#focusedWindow = null;
                return false;
            }
            this.#workspace = this.workspace;
            return this.#app === old.app && this.#testWindow(old.window);
        }
        if (current === old?.window) return this.#app === old.app;
        this.#workspace = this.workspace;
        if (!this.#testWindow(current)) return false;
        const isValidWindow = TaskbarClient.#service.isValidWindow(current);
        if (isValidWindow && !new Set(this.#app.get_windows()).has(current)) return false;
        else if (!isValidWindow && !new Set(this.#app.get_pids()).has(current.get_pid())) return false;
        TaskbarClient.#focusedWindow = { window: current, app: this.#app };
        return true;
    }

    /**
     * @param {() => void} callback
     * @param {Shell.App} app
     */
    constructor(callback, app) {
        if (typeof callback !== Type.Function) return;
        this.#callback = callback;
        if (app instanceof Shell.App) {
            this.#app = app;
        }
        if (!TaskbarClient.#service) {
            TaskbarClient.#service = new TaskbarService();
        }
        TaskbarClient.#service.addClient(this);
    }

    destroy() {
        this.#callback = null;
        this.#app = null;
        if (!TaskbarClient.#service) return;
        TaskbarClient.#service.removeClient(this);
        if (!TaskbarClient.#service.destroy()) return;
        TaskbarClient.#service = null;
        TaskbarClient.#focusedWindow = null;
    }

    /**
     * @param {boolean} [currentWorkspace]
     * @param {boolean} [skipTaskbar]
     * @returns {Set<Meta.Window>|null}
     */
    queryWindows(currentWorkspace = false, skipTaskbar = false) {
        if (!TaskbarClient.#service) return null;
        const windows = (
            this.#app ? TaskbarClient.#service.apps.get(this.#app) :
            new Set(TaskbarClient.#service.windows.keys())
        );
        if (!windows?.size) return null;
        if (this.#testQuery(currentWorkspace, skipTaskbar)) return windows;
        const result = new Set();
        for (const window of windows) {
            if (!this.#testWindow(window, currentWorkspace, skipTaskbar)) continue;
            result.add(window);
        }
        return result;
    }

    /**
     * @param {boolean} [currentWorkspace]
     * @param {boolean} [skipTaskbar]
     * @returns {Set<Shell.App>|null}
     */
    queryApps(currentWorkspace = false, skipTaskbar = false) {
        if (!TaskbarClient.#service) return null;
        if (this.#testQuery(currentWorkspace, skipTaskbar))
            return new Set(this.#app ? [this.#app] : TaskbarClient.#service.apps.keys());
        if (this.#app) {
            const windows = TaskbarClient.#service.apps.get(this.#app);
            if (!windows?.size) return null;
            for (const window of windows) {
                if (!this.#testWindow(window, currentWorkspace, skipTaskbar)) continue;
                return new Set([this.#app]);
            }
            return null;
        }
        const windows = TaskbarClient.#service.windows;
        if (!windows?.size) return null;
        const result = new Set();
        for (const [window, app] of windows) {
            if (result.has(app)) continue;
            if (!this.#testWindow(window, currentWorkspace, skipTaskbar)) continue;
            result.add(app);
        }
        return result;
    }

    /**
     * @param {Set<Shell.App>} apps
     */
    triggerNotify(apps) {
        if (typeof this.#callback !== Type.Function) return;
        if (!apps?.size || !this.#app || apps.has(this.#app)) this.#callback();
    }

    /**
     * @param {boolean} currentWorkspace
     * @param {boolean} skipTaskbar
     * @returns {boolean}
     */
    #testQuery(currentWorkspace = true, skipTaskbar = true) {
        if (skipTaskbar && !currentWorkspace) return true;
        this.#workspace = this.workspace;
        return false;
    }

    /**
     * @param {Meta.Window} window
     * @param {boolean} currentWorkspace
     * @param {boolean} skipTaskbar
     * @returns {boolean}
     */
    #testWindow(window, currentWorkspace = true, skipTaskbar = true) {
        if (!skipTaskbar && window.skip_taskbar) return false;
        if (currentWorkspace && window.get_workspace() !== this.#workspace) return false;
        return true;
    }

}
