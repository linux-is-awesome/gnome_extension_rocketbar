/**
 * @typedef {import('../core/shell.js').MessageTray.Source} MessageTraySource
 * @typedef {{window: Meta.Window, app: Shell.App, workspace: number, monitor?: string?}} WindowInfo
 */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { activateWindow as FocusedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import { Source as MessageTraySource, Urgency } from 'resource:///org/gnome/shell/ui/messageTray.js';
import Context from '../core/context.js';
import ChangeTracker from './taskbar/changeTracker.js';
import Favorites from './taskbar/favorites.js';
import WindowRouter from './taskbar/windowRouter.js';
import { AttentionBehavior, AttentionNotificationsBehavior } from '../utils/taskbar/appConfig.js';
import { SettingsPath, SettingsKey, Event, Delay, Property } from '../../shared/core/enums.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';

const CONFIG_KEY_APP_CONFIG = 'appConfig';
const WINDOW_ATTENTION_SOURCE_CLASS = 'WindowAttentionSource';

const SUPPORTED_WINDOW_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG
];

/** @enum {string} */
const ConfigField = {
    favorites: SettingsKey.ShowFavorites,
    windowRouting: SettingsKey.WindowRouting,
    showAllWindows: SettingsKey.ShowAllWindows,
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    preferredMonitor: SettingsKey.PreferredMonitor,
    attentionBehavior: SettingsKey.AttentionBehavior,
    attentionNotificationsBehavior: SettingsKey.AttentionNotificationsBehavior,
    [CONFIG_KEY_APP_CONFIG]: SettingsKey.AppButtonConfigOverride
};

/** @type {{[option: string]: *}} */
const ConfigOptions = {
    path: SettingsPath.Taskbar
};

/** @enum {string} */
export const TaskbarEvent = {
    Change: 'taskbar::change',
    Focus: 'taskbar::focus',
    Minimize: 'taskbar::minimize',
    Unminimize: 'taskbar::unminimize'
};

class TaskbarService {

    /** @type {Set<Meta.WindowType>} */
    #windowTypes = new Set(SUPPORTED_WINDOW_TYPES);

    /** @type {Shell.WindowTracker?} */
    #windowTracker = Shell.WindowTracker.get_default();

    /** @type {Meta.Workspace?} */
    #oldWorkspace = null;

    /** @type {Meta.Workspace?} */
    #workspace = null;

    /** @type {Favorites?} */
    #favorites = null;

    /** @type {WindowRouter?} */
    #windowRouter = null;

    /** @type {Map<Meta.Window, WindowInfo>?} */
    #windows = Context.getStorage(this.constructor.name);

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    #apps = new Map();

    /** @type {{window: Meta.Window, app: Shell.App}?} */
    #focusedWindowInfo = null;

    /** @type {Set<Shell.App>?} */
    #clientApps = new Set();

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    #clientAppWindows = new Map();

    /** @type {ChangeTracker?} */
    #tracker = new ChangeTracker(hasChangedApps => this.#handleTrackerState(hasChangedApps));

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    /** @type {{[appId: string]: {[key: string]: *}}?} */
    #appConfig = null;

    /** @type {Favorites?} */
    get favorites() {
        return this.#favorites;
    }

    /** @type {Meta.Workspace?} */
    get workspace() {
        return this.#workspace;
    }

    /** @type {Set<Meta.Window>?} */
    get windows() {
        return this.#windows ? new Set(this.#windows.keys()) : null;
    }

    /** @type {Shell.App?} */
    get focusedApp() {
        return this.#focusedWindowInfo?.app ?? null;
    }

    /** @type {Set<Shell.App>?} */
    get clientApps() {
        return this.#clientApps;
    }

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    get clientAppWindows() {
        return this.#clientAppWindows;
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return this.#oldWorkspace !== this.#workspace;
    }

    constructor() {
        Context.jobs.new(this).destroy(() => this.#initialize());
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#tracker?.hasClients) return false;
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        Context.hooks.removeAll(this);
        this.#tracker?.destroy();
        this.#windowRouter?.destroy();
        this.#favorites?.destroy();
        this.#clientApps?.clear();
        this.#clientAppWindows?.clear();
        this.#windows?.clear();
        this.#apps?.clear();
        this.#windows = null;
        this.#workspace = null;
        this.#tracker = null;
        this.#favorites = null;
        this.#windowRouter = null;
        this.#windowTracker = null;
        this.#apps = null;
        this.#clientApps = null;
        this.#clientAppWindows = null;
        this.#focusedWindowInfo = null;
        this.#config = null;
        this.#appConfig = null;
        return true;
    }

    /**
     * @param {TaskbarClient} client
     * @param {(event: TaskbarEvent) => void} callback
     */
    addClient(client, callback) {
        this.#tracker?.addClient(client, callback);
    }

    /**
     * @param {TaskbarClient} client
     */
    removeClient(client) {
        this.#tracker?.removeClient(client);
    }

    /**
     * @param {Shell.App?} [app]
     * @returns {boolean}
     */
    hasChanges(app) {
        if (!app || !this.#tracker) return false;
        return this.#tracker.hasChanges(app);
    }

    #initialize() {
        if (!this.#tracker) return;
        this.#handleConfig();
        this.#loadWindows();
        this.#handleWorkspace();
        if (!this.#workspace) return;
        this.#tracker.isActive = true;
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.AppStateChanged, (_, app) => this.#handleAppStateAsync(app)],
            [global.window_manager, Event.SwitchWorkspace, () => this.#handleWorkspace(),
                                    Event.WindowMapped, (_, windowActor) => this.#handleMappedWindow(windowActor),
                                    Event.Minimize, (_, windowActor) => this.#handleWindowMinimizedState(windowActor),
                                    Event.Unminimize, (_, windowActor) => this.#handleWindowMinimizedState(windowActor)],
            [global.display, Event.FocusWindow, () => this.#handleFocusedWindow(),
                             Event.WindowDemandsAttention, (_, window) => this.#handleWindowAttention(window),
                             Event.WindowMarkedUrgent, (_, window) => this.#handleWindowAttention(window)]);
        Context.hooks.add(this, MessageTraySource.prototype, MessageTraySource.prototype.addNotification,
            (source, notification) => this.#handleWindowAttentionNotification(source, notification), true);
    }

    /**
     * @param {string} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config) return;
        switch (settingsKey) {
            case ConfigField.attentionBehavior:
            case ConfigField.attentionNotificationsBehavior:
                return;
            case ConfigField.isolateWorkspaces:
            case ConfigField.showAllWindows:
                return this.#tracker?.trackAll(Delay.Queue);
        }
        if (!this.#appConfig || settingsKey === ConfigField.appConfig) {
            const appConfig = InnerConfig(this.#config, CONFIG_KEY_APP_CONFIG);
            this.#appConfig = appConfig && !Array.isArray(appConfig) ? appConfig : {};
        }
        this.#toggleFeatures();
        if (!this.#windowRouter) return;
        const { preferredMonitor } = this.#config;
        this.#windowRouter.preferredMonitor = preferredMonitor;
        this.#windowRouter.appConfig = this.#appConfig;
    }

    #toggleFeatures() {
        if (!this.#config || !this.#windows) return;
        const { favorites, windowRouting } = this.#config;
        if (!favorites && this.#favorites) {
            this.#favorites?.destroy();
            this.#favorites = null;
        } else if (favorites && !this.#favorites) {
            this.#favorites = new Favorites(() => this.#tracker?.trackAll(Delay.Queue, false));
        }
        if (!windowRouting && this.#windowRouter) {
            this.#windowRouter?.destroy();
            this.#windowRouter = null;
        } else if (windowRouting && !this.#windowRouter) {
            this.#windowRouter = new WindowRouter(this.#windows);
        }
    }

    #loadWindows() {
        if (!this.#windows) return;
        const windowActors = global.get_window_actors();
        if (!windowActors.length) return this.#windows.clear();
        const hasOldWindows = !!this.#windows.size;
        const newWindows = new Set();
        let hasValidOldWindow = false;
        for (const windowActor of windowActors) {
            const window = windowActor.metaWindow;
            const windowInfo = hasOldWindows ? this.#windows.get(window) : null;
            if (windowInfo) {
                hasValidOldWindow = true;
                newWindows.add(window);
                this.#addAppWindow(windowInfo);
                continue;
            }
            if (!this.#isValidWindow(window)) continue;
            newWindows.add(window);
            this.#addWindow(window);
        }
        if (!newWindows.size) return this.#windows.clear();
        if (!hasOldWindows) return;
        const oldWindows = this.#windows.keys();
        for (const window of oldWindows) {
            if (!newWindows.has(window)) this.#windows.delete(window);
        }
        if (!this.#windowRouter || !hasValidOldWindow) return;
        this.#windowRouter.restore();
    }

    #handleWorkspace() {
        const newWorkspace = global.workspace_manager.get_active_workspace();
        if (this.#workspace === newWorkspace) return;
        if (this.#workspace) Context.signals.remove(this, this.#workspace);
        this.#oldWorkspace = this.#workspace;
        this.#workspace = newWorkspace;
        Context.signals.add(this, [
            this.#workspace,
            Event.WindowAdded, (_, window) => this.#addWindowAsync(window), GObject.ConnectFlags.AFTER,
            Event.WindowRemoved, (_, window) => this.#removeWindowAsync(window), GObject.ConnectFlags.AFTER
        ]);
        this.#handleFocusedWindow();
        if (!this.#tracker?.isActive) return;
        const workspaceWindows = this.#workspace.list_windows();
        if (!workspaceWindows?.length) return this.#tracker.trackAll();
        for (const window of workspaceWindows) {
            if (!this.#isValidWindow(window)) continue;
            this.#addWindow(window);
        }
        this.#tracker.trackAll();
    }

    /**
     * @param {boolean} hasChangedApps
     */
    #handleTrackerState(hasChangedApps) {
        if (hasChangedApps) return this.#updateClientAppsAndWindows();
        this.#oldWorkspace = this.#workspace;
    }

    /**
     * @param {Shell.App} app
     * @param {Delay} [delay]
     */
    #handleAppStateAsync(app, delay = Delay.Idle) {
        if (!app) return;
        Context.jobs.removeAll(app).new(app, delay).destroy(() => this.#handleAppState(app));
    }

    /**
     * @param {Shell.App} app
     */
    #handleAppState(app) {
        if (!this.#apps || !this.#windows ||
            app instanceof Shell.App === false) return;
        switch (app.state) {
            case Shell.AppState.STARTING:
                return;
            case Shell.AppState.RUNNING:
                if (this.#apps.has(app)) return;
                const windows = app.get_windows();
                if (!windows.length) return;
                let hasValidWindows = false;
                for (const window of windows) {
                    if (!this.#isValidWindow(window)) continue;
                    this.#addWindowInfo(window, app);
                    hasValidWindows = true;
                }
                if (!hasValidWindows) return;
                return this.#tracker?.trackAppChange(app);
        }
        if (!this.#apps.has(app)) return;
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows?.size ||
            !this.#windows.size) return this.#tracker?.trackAppChange(app);
        for (const window of windows) {
            const windowInfo = this.#windows.get(window);
            if (!windowInfo ||
                (windowInfo.app !== app && this.#apps.has(windowInfo.app))) continue;
            this.#windows.delete(window);
        }
        this.#tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.WindowActor} windowActor
     */
    #handleMappedWindow(windowActor) {
        if (!windowActor || !this.#windows) return;
        const window = windowActor.meta_window;
        if (!window) return;
        if (!this.#windows.has(window)) {
            if (!this.#isValidWindow(window)) return;
            this.#addWindow(window);
        }
        const windowInfo = this.#windows.get(window);
        if (windowInfo) this.#routeWindow(windowInfo);
    }

    /**
     * Note: Async execution is required in order to extract an app from the window.
     *       Connecting signals using GObject.ConnectFlags.AFTER isn't really helpful in this case.
     *
     * @param {Meta.Window} window
     */
    #addWindowAsync(window) {
        if (!this.#windows || !this.#isValidWindow(window)) return;
        const [windowInfo, isWorkspaceChanged] = this.#updateWindowInfo(window);
        if (!windowInfo) Context.jobs.new(window).destroy(() => this.#addWindow(window));
        else if (isWorkspaceChanged) this.#tracker?.trackAppChange(windowInfo.app);
    }

    /**
     * @param {Meta.Window} window
     */
    #addWindow(window) {
        if (!this.#windows || !window) return;
        const [windowInfo] = this.#updateWindowInfo(window);
        if (windowInfo) return;
        const app = this.#windowTracker?.get_window_app(window);
        if (!app) return;
        this.#addWindowInfo(window, app);
        this.#tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.Window} window
     * @param {Shell.App} app
     */
    #addWindowInfo(window, app) {
        if (!window || !app || !this.#windows) return;
        const workspace = window.get_workspace()?.index() ?? null;
        const windowInfo = { window, app, workspace };
        this.#windows.set(window, windowInfo);
        this.#addAppWindow(windowInfo);
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    #addAppWindow(windowInfo) {
        if (!this.#apps) return;
        const { window, app } = windowInfo;
        if (!window || !app) return;
        const appWindows = this.#apps.get(app);
        if (!appWindows) this.#apps.set(app, new Set([window]));
        else if (!appWindows.has(window)) appWindows.add(window);
    }

    /**
     * Note: Async execution is required in order to check existing app windows.
     *
     * @param {Meta.Window} window
     */
    #removeWindowAsync(window) {
        if (!this.#windows) return;
        const jobs = Context.jobs.removeAll(window);
        if (!this.#windows.has(window)) return;
        jobs.new(window).destroy(() => this.#removeWindow(window));
    }

    /**
     * @param {Meta.Window} window
     */
    #removeWindow(window) {
        if (!this.#windows || !window) return;
        const [windowInfo, isWorkspaceChanged] = this.#updateWindowInfo(window, true);
        const app = windowInfo?.app;
        if (!app) return;
        const isValid = !!windowInfo.workspace ||
                        new WeakSet(app.get_windows()).has(window);
        if (isValid && isWorkspaceChanged) return this.#tracker?.trackAppChange(app);
        if (isValid) return;
        this.#windows.delete(window);
        if (!this.#apps?.has(app)) return;
        const windows = this.#apps.get(app);
        windows?.delete(window);
        if (!windows?.size) this.#apps.delete(app);
        this.#tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.Window} window
     * @param {boolean} [updateMonitor]
     * @returns {[windowInfo?: WindowInfo, isWorkspaceChanged?: boolean]}
     */
    #updateWindowInfo(window, updateMonitor = false) {
        const windowInfo = this.#windows?.get(window);
        if (!windowInfo) return [];
        if (updateMonitor) {
            const monitorIndex = window.get_monitor();
            windowInfo.monitor = Context.monitors.getMonitor(monitorIndex);
        }
        const oldWorkspace = windowInfo.workspace;
        const newWorkspace = window.get_workspace()?.index() ?? null;
        if (typeof newWorkspace === 'number' &&
            newWorkspace >= 0 &&
            oldWorkspace === newWorkspace) return [windowInfo, false];
        windowInfo.workspace = newWorkspace;
        return [windowInfo, true];
    }

    #handleFocusedWindow() {
        if (!this.#windows || !this.#windowTracker) return;
        const old = this.#focusedWindowInfo;
        const window = global.display.get_focus_window();
        if ((!window && !old) ||
            (window && window === old?.window) ||
            !this.#isValidWindow(window)) return;
        if (!window && old) {
            const oldFocusedWindow = old.window;
            const isOldWindowFocused = !oldFocusedWindow.minimized && !!oldFocusedWindow.get_pid() &&
                                       oldFocusedWindow.get_workspace() === this.#workspace &&
                                       global.stage.get_key_focus() instanceof Clutter.Actor === false;
            if (isOldWindowFocused) return;
        }
        const app = window ? this.#windows.get(window)?.app ??
                             this.#windowTracker.get_window_app(window) ?? null : null;
        this.#focusedWindowInfo = !!window && !!app ? { window, app } : null;
        if (this.isWorkspaceChanged) return;
        this.#tracker?.trackAppFocus(app, old?.app);
    }

    /**
     * @param {Meta.Window} window
     */
    #handleWindowAttention(window) {
        if (!this.#windowTracker || !this.#config ||
            window instanceof Meta.Window === false || window.has_focus()) return;
        const app = this.#windowTracker.get_window_app(window);
        if (!app?.id) return;
        const appConfig = this.#appConfig?.[app.id] ?? null;
        const behavior = appConfig?.attentionBehavior || this.#config.attentionBehavior;
        switch (behavior) {
            case AttentionBehavior.FocusActive:
                const focusedWindow = global.display.get_focus_window();
                const appWindows = app.get_windows();
                const isActive = !!focusedWindow && new WeakSet(appWindows).has(focusedWindow);
                if (!isActive) return;
            case AttentionBehavior.FocusWorkspace:
                if (window.get_workspace() !== this.#workspace) return;
            case AttentionBehavior.FocusAll:
                FocusedWindow(window);
        }
    }

    /**
     * @param {MessageTraySource} source
     * @param {*} notification
     */
    #handleWindowAttentionNotification(source, notification) {
        if (!this.#windowTracker || !this.#config || !notification ||
            source?.constructor?.name !== WINDOW_ATTENTION_SOURCE_CLASS) return;
        const window = source._window;
        if (window instanceof Meta.Window === false) return;
        const app = this.#windowTracker.get_window_app(window);
        if (!app?.id) return;
        const appConfig = this.#appConfig?.[app.id] ?? null;
        const behavior = appConfig?.attentionNotificationsBehavior ??
                         this.#config.attentionNotificationsBehavior;
        switch (behavior) {
            case AttentionNotificationsBehavior.Disable:
                Context.jobs.removeAll(source).new(source).destroy(() => (
                    notification.destroy(), source.destroy()));
                return;
            case AttentionNotificationsBehavior.Hide:
            case AttentionNotificationsBehavior.Show:
            case AttentionNotificationsBehavior.Critical:
                const value = behavior !== AttentionNotificationsBehavior.Hide;
                if (source.policy.showBanners === value) return;
                const propertyDescriptor = { value, writable: true };
                Object.defineProperty(source.policy, Property.ShowBanners, propertyDescriptor);
                if (behavior !== AttentionNotificationsBehavior.Critical) return;
                notification.urgency = Urgency.CRITICAL;
        }
    }

    /**
     * @param {Meta.WindowActor} windowActor
     */
    #handleWindowMinimizedState(windowActor) {
        if (!windowActor || !this.#windows || !this.#tracker) return;
        const window = windowActor.meta_window;
        if (!window) return;
        const windowInfo = this.#windows.get(window);
        const app = windowInfo?.app;
        if (!app) return;
        const event = window.minimized ? TaskbarEvent.Minimize : TaskbarEvent.Unminimize;
        this.#tracker.routeAppEvent(app, event);
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

    #updateClientAppsAndWindows() {
        if (!this.#config || !this.#windows || !this.#apps ||
            !this.#clientApps || !this.#clientAppWindows) return;
        const { isolateWorkspaces, showAllWindows } = this.#config;
        this.#clientApps.clear();
        this.#clientAppWindows.clear();
        if (!isolateWorkspaces && showAllWindows) {
            this.#clientApps = new Set(this.#apps.keys());
            this.#clientAppWindows = new Map([...this.#apps]);
            return;
        }
        for (const [window, windowInfo] of this.#windows) {
            const { app } = windowInfo;
            if (!app) continue;
            if (!showAllWindows && window.is_skip_taskbar()) continue;
            if (isolateWorkspaces && window.get_workspace() !== this.#workspace) continue;
            this.#clientApps.add(app);
            if (this.#clientAppWindows.has(app)) this.#clientAppWindows.get(app)?.add(window);
            else this.#clientAppWindows.set(app, new Set([window]));
        }
    }

    /**
     * @param {Meta.Window?} window
     * @returns {boolean}
     */
    #isValidWindow(window) {
        return window instanceof Meta.Window && this.#windowTypes.has(window.get_window_type());
    }

}

export class TaskbarClient {

    /** @type {TaskbarService?} */
    static #service = null;

    /** @type {Shell.App?} */
    #app = null;

    /** @type {Shell.App?} */
    get app() {
        return this.#app;
    }

    /** @type {Favorites?} */
    get favorites() {
        return TaskbarClient.#service?.favorites ?? null;
    }

    /** @type {Meta.Workspace?} */
    get workspace() {
        return TaskbarClient.#service?.workspace ?? null;
    }

    /** @type {Set<Shell.App>?} */
    get apps() {
        const service = TaskbarClient.#service;
        if (!service) return null;
        if (!this.#app) return service.clientApps;
        return service.clientApps?.has(this.#app) ? new Set([this.#app]) : null;
    }

    /** @type {Set<Meta.Window>?} */
    get windows() {
        const service = TaskbarClient.#service;
        if (!service) return null;
        if (!this.#app) return service.windows;
        return service.clientAppWindows?.get(this.#app) ?? null;
    }

    /** @type {boolean} */
    get hasFocus() {
        if (!this.#app) return !!TaskbarClient.#service?.focusedApp;
        return this.#app === TaskbarClient.#service?.focusedApp;
    }

    /** @type {boolean} */
    get hasChanges() {
        return !!TaskbarClient.#service?.hasChanges(this.#app);
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return !!TaskbarClient.#service?.isWorkspaceChanged;
    }

    /**
     * @param {(event: TaskbarEvent) => void} callback
     * @param {Shell.App?} [app]
     */
    constructor(callback, app) {
        if (typeof callback !== 'function') return;
        this.#app = app instanceof Shell.App ? app : null;
        TaskbarClient.#service ??= new TaskbarService();
        TaskbarClient.#service.addClient(this, callback);
    }

    destroy() {
        TaskbarClient.#service?.removeClient(this);
        this.#app = null;
        if (!TaskbarClient.#service?.destroy()) return;
        TaskbarClient.#service = null;
    }

}
