/**
 * JSDoc types
 *
 * @typedef {import('../core/context/jobs.js').Jobs.Job} Job
 * @typedef {{window: Meta.Window, app: Shell.App, workspace: number, monitor?: string?, hasFocus?: boolean}} WindowInfo
 */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Context from '../core/context.js';
import { Event, Delay } from '../core/enums.js';
import { Config } from '../utils/config.js';
import Favorites from './taskbar/favorites.js';
import WindowRouter from './taskbar/windowRouter.js';

const CONFIG_PATH = 'taskbar';

const SUPPORTED_WINDOW_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG
];

/** @enum {string} */
const ConfigFields = {
    enableFavorites: 'taskbar-show-favorites',
    windowRouting: 'multi-monitor-window-routing'
};

class TaskbarService {

    /** @type {Set<Meta.WindowType>} */
    #windowTypes = new Set(SUPPORTED_WINDOW_TYPES);

    /** @type {Shell.WindowTracker} */
    #windowTracker = Shell.WindowTracker.get_default();

    /** @type {WindowRouter?} */
    #windowRouter = null;

    /** @type {Meta.Workspace?} */
    #oldWorkspace = null;

    /** @type {Meta.Workspace?} */
    #workspace = null;

    /** @type {Favorites?} */
    #favorites = null;

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    #apps = new Map();

    /** @type {Map<Meta.Window, WindowInfo>?} */
    #windows = Context.getStorage(this.constructor.name);

    /** @type {Set<Shell.App>?} */
    #trackedApps = new Set();

    /** @type {Set<TaskbarClient>?} */
    #clients = new Set();

    /** @type {Config?} */
    #config = Config(this, ConfigFields, () => this.#handleConfig(), { path: CONFIG_PATH });

    /** @type {Job?} */
    #job = null;

    /** @type {Favorites?} */
    get favorites() {
        return this.#favorites;
    }

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    get apps() {
        return this.#apps;
    }

    /** @type {Map<Meta.Window, WindowInfo>?} */
    get windows() {
        return this.#windows;
    }

    /** @type {Meta.Workspace?} */
    get workspace() {
        return this.#workspace;
    }

    /** @type {Set<Shell.App>?} */
    get trackedApps() {
        return this.#trackedApps;
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return this.#oldWorkspace !== this.#workspace;
    }

    constructor() {
        this.#job = Context.jobs.new(this).queue(() => this.#initialize());
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#clients?.size) return false;
        Context.signals.removeAll(this);
        this.#job?.destroy();
        this.#favorites?.destroy();
        this.#windowRouter?.destroy();
        this.#apps?.clear();
        this.#trackedApps?.clear();
        this.#clients?.clear();
        this.#job = null;
        this.#workspace = null;
        this.#favorites = null;
        this.#windowRouter = null;
        this.#trackedApps = null;
        this.#apps = null;
        this.#windows = null;
        this.#clients = null;
        this.#config = null;
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
        return window instanceof Meta.Window && this.#windowTypes.has(window.get_window_type());
    }

    #initialize() {
        this.#handleConfig();
        this.#handleWindows();
        this.#handleWorkspace();
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.AppStateChanged, (_, app) => this.#handleAppStateAsync(app)],
            [global.window_manager, Event.SwitchWorkspace, () => this.#handleWorkspace(),
                                    Event.WindowMapped, (_, windowActor) => this.#handleWindowMapped(windowActor)]);
    }

    #handleConfig() {
        if (!this.#config || !this.#windows) return;
        const { enableFavorites, windowRouting } = this.#config;
        if (!enableFavorites && this.#favorites) {
            this.#favorites?.destroy();
            this.#favorites = null;
        } else if (enableFavorites && !this.#favorites) {
            this.#favorites = new Favorites(() => this.#trackAll(Delay.Queue));
        }
        if (!windowRouting && this.#windowRouter) {
            this.#windowRouter?.destroy();
            this.#windowRouter = null;
        } else if (windowRouting && !this.#windowRouter) {
            this.#windowRouter = new WindowRouter(this.#windows);
        }
    }

    #handleWindows() {
        if (!this.#windows) return;
        const windowActors = global.get_window_actors();
        if (!windowActors.length) return this.#windows.clear();
        const hasOldWindows = !!this.#windows.size;
        const newWindows = new Set();
        let hasValidOldWindow = false;
        for (let i = 0, l = windowActors.length; i < l; ++i) {
            const window = windowActors[i].metaWindow;
            const windowInfo = hasOldWindows ? this.#windows.get(window) : null;
            if (windowInfo) {
                hasValidOldWindow = true;
                newWindows.add(window);
                this.#handleWindowInfo(windowInfo);
                continue;
            }
            if (!this.isValidWindow(window)) continue;
            newWindows.add(window);
            this.#addWindow(window, false);
        }
        if (!newWindows.size) return this.#windows.clear();
        if (!hasOldWindows) return;
        const oldWindows = this.#windows.keys();
        for (const window of oldWindows) {
            if (!newWindows.has(window)) this.#windows.delete(window);
        }
        if (!this.#windowRouter || !hasValidOldWindow) return;
        this.#windowRouter.recover();
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
        const workspaceWindows = this.#workspace?.list_windows();
        if (!workspaceWindows?.length) return this.#trackAll();
        for (let i = 0, l = workspaceWindows.length; i < l; ++i) {
            const window = workspaceWindows[i];
            if (!this.isValidWindow(window)) continue;
            this.#addWindow(window, false);
        }
        this.#trackAll();
    }

    /**
     * @param {Shell.App} app
     */
    #handleAppStateAsync(app) {
        if (!app?.id) return;
        Context.jobs.removeAll(app).new(app).destroy(() => this.#handleAppState(app));
    }

    /**
     * @param {Shell.App} app
     */
    #handleAppState(app) {
        if (!this.#apps || !this.#windows ||
            app instanceof Shell.App === false) return;
        switch (app.state) {
            case Shell.AppState.STARTING: return;
            case Shell.AppState.RUNNING:
                if (this.#apps.has(app)) return;
                const windows = app.get_windows();
                if (!windows.length) return;
                let hasValidWindows = false;
                for (let i = 0, l = windows.length; i < l; ++i) {
                    const window = windows[i];
                    if (!this.isValidWindow(window)) continue;
                    this.#createWindowInfo(window, app);
                    hasValidWindows = true;
                }
                if (!hasValidWindows) return;
                return this.#trackApp(app);
            default: if (!this.#apps.has(app)) return;
        }
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows?.size || !this.#windows.size) return this.#trackApp(app);
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
        if (!this.#windows || !this.isValidWindow(window)) return;
        const windowInfo = this.#updateWindowInfo(window);
        if (windowInfo) return this.#trackApp(windowInfo.app);
        Context.jobs.new(window).destroy(() => this.#addWindow(window));
    }

    /**
     * @param {Meta.Window} window
     * @param {boolean} [track]
     */
    #addWindow(window, track = true) {
        if (!this.#windows || this.#updateWindowInfo(window)) return;
        const app = this.#windowTracker.get_window_app(window);
        if (typeof app?.id !== 'string') return;
        this.#createWindowInfo(window, app);
        if (track) this.#trackApp(app);
    }

    /**
     * Note: Async execution is required in order to check existing app windows.
     *
     * @param {Meta.Window} window
     */
    #removeWindowAsync(window) {
        if (!this.#windows || !this.isValidWindow(window)) return;
        Context.jobs.removeAll(window);
        if (!this.#windows.has(window)) return;
        Context.jobs.new(window).destroy(() => this.#removeWindow(window));
    }

    /**
     * @param {Meta.Window} window
     */
    #removeWindow(window) {
        if (!this.#windows) return;
        const app = this.#updateWindowInfo(window)?.app;
        if (!app) return;
        const appWindows = new WeakSet(app.get_windows());
        if (appWindows.has(window)) return this.#trackApp(app);
        this.#windows.delete(window);
        if (!this.#apps?.has(app)) return;
        const windows = this.#apps.get(app);
        windows?.delete(window);
        if (!windows?.size) this.#apps.delete(app);
        this.#trackApp(app);
    }

    /**
     * @param {Meta.Window} window
     * @param {Shell.App} app
     */
    #createWindowInfo(window, app) {
        if (!window || !app || !this.#windows) return;
        const workspace = window.get_workspace().index();
        const windowInfo = { window, app, workspace };
        this.#windows.set(window, windowInfo);
        this.#handleWindowInfo(windowInfo);
    }

    /**
     * @param {Meta.Window} window
     * @returns {WindowInfo?}
     */
    #updateWindowInfo(window) {
        const windowInfo = this.#windows?.get(window);
        if (!windowInfo) return null;
        if (this.#windowRouter?.isRouting) return windowInfo;
        Context.jobs.new(window).destroy(() => {
            if (this.#windowRouter?.isRouting || !this.#windows?.has(window)) return;
            windowInfo.workspace = window.get_workspace().index();
        });
        return windowInfo;
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    #handleWindowInfo(windowInfo) {
        if (!this.#apps || !windowInfo) return;
        const { window, app } = windowInfo;
        if (!window || !app) return;
        const appWindows = this.#apps.get(app);
        if (!appWindows) this.#apps.set(app, new Set([window]));
        else if (!appWindows.has(window)) appWindows.add(window);
        if (this.#workspace) this.#routeWindow(windowInfo);
    }

    /**
     * @param {Meta.WindowActor} windowActor
     */
    #handleWindowMapped(windowActor) {
        if (!windowActor || !this.#windowRouter) return;
        const window = windowActor.meta_window;
        if (!window || !this.#windows) return;
        const windowInfo = this.#windows.get(window);
        if (windowInfo) this.#routeWindow(windowInfo);
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    #routeWindow(windowInfo) {
        if (!this.#windowRouter || !windowInfo?.window) return;
        const { window } = windowInfo;
        Context.jobs.new(window).destroy(() =>
            this.#windows?.has(window) && this.#windowRouter?.route(windowInfo));
    }

    /**
     * @param {number} [delay]
     */
    #trackAll(delay = Delay.Idle) {
        if (!this.#workspace) return;
        this.#trackedApps = null;
        this.#job?.reset(delay).queue(() => this.#notifyClients());
    }

    /**
     * @param {Shell.App?} app
     */
    #trackApp(app) {
        if (!this.#workspace || !this.#trackedApps ||
            !app || this.#trackedApps.has(app)) return;
        this.#trackedApps.add(app);
        this.#job?.reset(Delay.Queue).queue(() => this.#notifyClients());
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

    /** @type {TaskbarService?} */
    static #service = null;

    /** @type {{window: Meta.Window, app: Shell.App}?} */
    static #focusedWindow = null;

    /** @type {Shell.App?} */
    #app = null;

    /** @type {(() => void)?} */
    #callback = null;

    /** @type {Meta.Workspace?} */
    #workspace = null;

    /** @type {Favorites?} */
    get favorites() {
        return TaskbarClient.#service?.favorites ?? null;
    }

    /** @type {Meta.Workspace?} */
    get workspace() {
        return TaskbarClient.#service?.workspace ?? null;
    }

    /** @type {boolean} */
    get isPending() {
        return this.#app && TaskbarClient.#service?.trackedApps?.has(this.#app) || false;
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return TaskbarClient.#service?.isWorkspaceChanged ?? false;
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
        if (current === old?.window) return this.#app === old?.app;
        this.#workspace = this.workspace;
        if (!this.#testWindow(current)) return false;
        const isValidWindow = TaskbarClient.#service.isValidWindow(current);
        if (isValidWindow && !new WeakSet(this.#app.get_windows()).has(current)) return false;
        else if (!isValidWindow && !new Set(this.#app.get_pids()).has(current.get_pid())) return false;
        TaskbarClient.#focusedWindow = { window: current, app: this.#app };
        return true;
    }

    /**
     * @param {() => void} callback
     * @param {Shell.App?} [app]
     */
    constructor(callback, app) {
        if (typeof callback !== 'function') return;
        this.#callback = callback;
        this.#app = app instanceof Shell.App ? app : null;
        TaskbarClient.#service ??= new TaskbarService();
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
     * @returns {Set<Meta.Window>?}
     */
    queryWindows(currentWorkspace = false, skipTaskbar = false) {
        const service = TaskbarClient.#service;
        if (!service) return null;
        const windows = this.#app ? service.apps?.get(this.#app) : new Set(service.windows?.keys());
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
     * @returns {Set<Shell.App>?}
     */
    queryApps(currentWorkspace = false, skipTaskbar = false) {
        const service = TaskbarClient.#service;
        if (!service) return null;
        if (this.#testQuery(currentWorkspace, skipTaskbar)) {
            return new Set(this.#app ? [this.#app] : service.apps?.keys());
        }
        if (this.#app) {
            const windows = service.apps?.get(this.#app);
            if (!windows?.size) return null;
            for (const window of windows) {
                if (!this.#testWindow(window, currentWorkspace, skipTaskbar)) continue;
                return new Set([this.#app]);
            }
            return null;
        }
        const windows = service.windows;
        if (!windows?.size) return null;
        const result = new Set();
        for (const [window, windowInfo] of windows) {
            const app = windowInfo.app;
            if (!app || result.has(app)) continue;
            if (!this.#testWindow(window, currentWorkspace, skipTaskbar)) continue;
            result.add(app);
        }
        return result;
    }

    /**
     * @param {Set<Shell.App>?} [apps]
     */
    triggerNotify(apps) {
        if (typeof this.#callback !== 'function') return;
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
