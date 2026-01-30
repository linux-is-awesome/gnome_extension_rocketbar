/**
 * @typedef {import('../core/shell.js').MessageTray.Source} MessageTraySource
 */

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import { activateWindow as FocusedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import { Source as MessageTraySource, Urgency } from 'resource:///org/gnome/shell/ui/messageTray.js';
import Context from '../core/context.js';
import WindowInfo from './taskbar/windowInfo.js';
import ChangeTracker from './taskbar/changeTracker.js';
import Favorites from './taskbar/favorites.js';
import { WindowPreview } from '../ui/base/windowPreview.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { AppConfigValue } from '../../shared/utils/taskbar/appConfig.js';
import { NotificationSourceInfo } from '../utils/notificationSourceInfo.js';
import { Event, Delay, Property } from '../../shared/enums/general.js';
import { ServiceConfigField as ConfigField,
         ConfigOptions, ConfigKey,
         ActivationBehavior,
         AttentionBehavior,
         NotificationsBehavior } from '../../shared/enums/taskbar.js';

const DEFAULT_ROUTING_DELAY = Delay.Scheduled;

const SUPPORTED_WINDOW_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG
];

/** @type {{[prop: string]: *}} */
const RoutingHelperProps = {
    name: 'Rocketbar__TaskbarService_RoutingHelper',
    opacity: 0
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

    /** @type {Map<Meta.Window, WindowInfo>?} */
    #windows = Context.getStorage(this.constructor.name);

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    #apps = new Map();

    /** @type {{window: Meta.Window, app: Shell.App}?} */
    #focusedWindowInfo = null;

    /** @type {Clutter.Actor?} */
    #routingHelper = null;

    /** @type {boolean} */
    #isRouting = false;

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    /** @type {{[appId: string]: Config}?} */
    #appConfig = null;

    /** @type {ChangeTracker?} */
    tracker = new ChangeTracker(hasChangedApps => this.#handleTrackerState(hasChangedApps));

    /** @type {Favorites?} */
    favorites = null;

    /** @type {Meta.Workspace?} */
    workspace = null;

    /** @type {Set<Shell.App>?} */
    clientApps = new Set();

    /** @type {Map<Shell.App, Set<Meta.Window>>?} */
    clientAppWindows = new Map();

    /** @type {Set<Meta.Window>?} */
    get windows() {
        return this.#windows ? new Set(this.#windows.keys()) : null;
    }

    /** @type {Shell.App?} */
    get focusedApp() {
        return this.#focusedWindowInfo?.app ?? null;
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return this.#oldWorkspace !== this.workspace;
    }

    /** @type {boolean} */
    get isRouting() {
        if (this.#isRouting) return true;
        const monitors = Context.monitors;
        return monitors.has(this) && monitors.isUpdating;
    }

    constructor() {
        Context.jobs.new(this).destroy(() => this.#initialize());
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.tracker?.hasClients) return false;
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        Context.hooks.removeAll(this);
        Context.monitors.disconnect(this);
        this.#stopWindowRouting();
        this.tracker?.destroy();
        this.favorites?.destroy();
        this.clientApps?.clear();
        this.clientAppWindows?.clear();
        this.#apps?.clear();
        this.#windows = null;
        this.#windowTracker = null;
        this.#apps = null;
        this.#focusedWindowInfo = null;
        this.#config = null;
        this.#appConfig = null;
        this.workspace = null;
        this.tracker = null;
        this.favorites = null;
        this.clientApps = null;
        this.clientAppWindows = null;
        return true;
    }

    /**
     * @param {Shell.App} app
     * @param {ActivationBehavior?} [behavior]
     */
    activate(app, behavior = null) {
        const appWindows = app.get_windows();
        behavior ??= !this.#config || !appWindows.length ? ActivationBehavior.Default :
                     AppConfigValue(app.id, this.#appConfig, this.#config, ConfigKey.ActivationBehavior);
        switch (behavior) {
            case ActivationBehavior.MoveWindows:
                if (!appWindows.length || !this.workspace) return;
                for (const window of appWindows) window.change_workspace(this.workspace);
                appWindows[0].activate(global.get_current_time());
                break;
            case ActivationBehavior.FindWindow:
                if (appWindows.length) FocusedWindow(appWindows[0]);
                break;
            case ActivationBehavior.Default:
            default:
                const canOpenNewWindow = !!appWindows.length && app.can_open_new_window();
                if (canOpenNewWindow) app.open_new_window(-1);
                else app.activate();
        }
    }

    #initialize() {
        if (!this.tracker) return;
        this.#handleConfig();
        this.#loadWindows();
        this.#handleWorkspace();
        if (!this.workspace) return;
        this.tracker.isActive = true;
        Context.signals.add(this,
            [Shell.AppSystem.get_default(), Event.AppStateChanged, (_, app) => this.#handleAppStateAsync(app)],
            [global.window_manager, Event.SwitchWorkspace, () => this.#handleWorkspace(),
                                    Event.WindowMapped, (_, windowActor) => this.#handleMappedWindow(windowActor),
                                    Event.Minimize, (_, windowActor) => this.#handleWindowMinimizedState(windowActor),
                                    Event.Unminimize, (_, windowActor) => this.#handleWindowMinimizedState(windowActor)],
            [global.display, Event.FocusWindow, () => this.#handleFocusedWindow(),
                             Event.WindowDemandsAttention, (_, window) => this.#handleWindowAttention(window),
                             Event.WindowMarkedUrgent, (_, window) => this.#handleWindowAttention(window),
                             Event.WindowEnteredMonitor, (_, __, window) => this.#handleWindowMonitor(window)]);
        Context.hooks.add(this, MessageTraySource.prototype, MessageTraySource.prototype.addNotification,
            (source, notification) => this.#handleAppNotification(source, notification), true);
    }

    /**
     * @param {string} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config) return;
        switch (settingsKey) {
            case ConfigField.preferredMonitor:
            case ConfigField.attentionBehavior:
            case ConfigField.attentionNotificationsBehavior:
            case ConfigField.notificationsBehavior:
                return;
            case ConfigField.isolateWorkspaces:
            case ConfigField.showAllWindows:
                return this.tracker?.trackAll(Delay.Queue);
        }
        const { favorites, windowRouting, windowRoutingWatchdog } = this.#config;
        if (!favorites && this.favorites) {
            this.favorites?.destroy();
            this.favorites = null;
        } else if (favorites && !this.favorites) {
            this.favorites = new Favorites(() => this.tracker?.trackAll(Delay.Queue, false));
        }
        if (!this.#appConfig || settingsKey === ConfigField.appConfig) {
            const appConfig = InnerConfig(this.#config, ConfigKey.AppConfig);
            this.#appConfig = appConfig && !Array.isArray(appConfig) ? appConfig : {};
        }
        if (!windowRouting || !windowRoutingWatchdog) Context.monitors.disconnect(this);
        else Context.monitors.connect(this, () => this.#scheduleWindowRouting());
    }

    #loadWindows() {
        if (!this.#windows || !this.#config) return;
        const windowActors = global.get_window_actors();
        if (!windowActors.length) return this.#windows.clear();
        this.#isRouting = !Context.isNew && Context.monitors.has(this);
        const hasOldWindows = !!this.#windows.size;
        const newWindows = new Set();
        for (const windowActor of windowActors) {
            const window = windowActor.get_meta_window();
            if (!window || !this.#isValidWindow(window)) continue;
            newWindows.add(window);
            let windowInfo = hasOldWindows ? this.#windows.get(window) : null;
            if (windowInfo) this.#addAppWindow(windowInfo);
            else this.#addWindow(window);
            if (this.#isRouting) continue;
            windowInfo ??= this.#windows.get(window);
            windowInfo?.update();
        }
        if (!newWindows.size) return this.#windows.clear();
        if (hasOldWindows) {
            const oldWindows = this.#windows.keys();
            for (const window of oldWindows) {
                if (newWindows.has(window)) continue;
                this.#windows.delete(window);
            }
        }
        if (this.#isRouting) this.#scheduleWindowRouting();
    }

    #handleWorkspace() {
        if (!this.#windows) return;
        const newWorkspace = global.workspace_manager.get_active_workspace();
        if (this.workspace === newWorkspace) return;
        if (this.workspace) Context.signals.remove(this, this.workspace);
        this.#oldWorkspace = this.workspace;
        this.workspace = newWorkspace;
        Context.signals.add(this, [
            this.workspace,
            Event.WindowAdded, (_, window) => this.#addWindowAsync(window), GObject.ConnectFlags.AFTER,
            Event.WindowRemoved, (_, window) => this.#removeWindowAsync(window), GObject.ConnectFlags.AFTER
        ]);
        this.#handleFocusedWindow();
        if (!this.tracker?.isActive) return;
        const workspaceWindows = this.workspace.list_windows();
        if (!workspaceWindows?.length) return this.tracker.trackAll();
        for (const window of workspaceWindows) {
            const windowInfo = this.#windows.get(window)?.update();
            if (windowInfo || !this.#isValidWindow(window)) continue;
            this.#addWindow(window);
        }
        this.tracker.trackAll();
    }

    /**
     * @param {boolean} hasChangedApps
     */
    #handleTrackerState(hasChangedApps) {
        if (hasChangedApps) return this.#updateClientAppsAndWindows();
        this.#oldWorkspace = this.workspace;
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
                return this.tracker?.trackAppChange(app);
        }
        if (!this.#apps.has(app)) return;
        const windows = this.#apps.get(app);
        this.#apps.delete(app);
        if (!windows?.size ||
            !this.#windows.size) return this.tracker?.trackAppChange(app);
        for (const window of windows) {
            const windowInfo = this.#windows.get(window);
            if (!windowInfo) continue;
            if (windowInfo.app !== app && this.#apps.has(windowInfo.app)) continue;
            this.#removeWindowInfo(window);
        }
        this.tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.WindowActor} windowActor
     */
    #handleMappedWindow(windowActor) {
        if (!windowActor || !this.#windows || !this.#config) return;
        const window = windowActor.get_meta_window();
        if (!window) return;
        if (!this.#windows.has(window)) {
            if (!this.#isValidWindow(window)) return;
            this.#addWindow(window);
        }
        const windowInfo = this.#windows.get(window);
        if (!windowInfo) return;
        if (!this.#routeWindow(windowInfo)) windowInfo.updateMonitor();
    }

    #handleFocusedWindow() {
        if (!this.#windows || !this.#windowTracker) return;
        const old = this.#focusedWindowInfo;
        const oldWindow = old?.window;
        const focusedWindow = global.display.get_focus_window();
        const window = focusedWindow instanceof Meta.Window ? focusedWindow : null;
        if ((!window && !oldWindow) ||
            (window && window === oldWindow)) return;
        if (!window && oldWindow) {
            const isOldWindowFocused = !oldWindow.minimized && !!oldWindow.get_pid() &&
                                       oldWindow.get_workspace() === this.workspace &&
                                       global.stage.get_key_focus() instanceof Clutter.Actor === false;
            if (isOldWindowFocused) return;
        }
        const app = window ? this.#windows.get(window)?.app ??
                             this.#windowTracker.get_window_app(window) ?? null : null;
        this.#focusedWindowInfo = !!window && !!app ? { window, app } : null;
        if (this.isWorkspaceChanged) return;
        this.tracker?.trackAppFocus(app, old?.app);
    }

    /**
     * @param {Meta.Window} window
     */
    #handleWindowMonitor(window) {
        if (!this.#windows || !window) return;
        const windowInfo = this.#windows.get(window);
        if (windowInfo?.isRouting) windowInfo.routeToWorkspace();
        else this.#addWindowAsync(window);
    }

    /**
     * Note: Async execution is required in order to extract an app from the window.
     *
     * @param {Meta.Window} window
     */
    #addWindowAsync(window) {
        if (!this.#windows || !this.#isValidWindow(window)) return;
        Context.jobs.removeAll(window).new(window).destroy(() => this.#addWindow(window));
    }

    /**
     * @param {Meta.Window} window
     */
    #addWindow(window) {
        if (!this.#windows || !window) return;
        const windowInfo = this.#windows.get(window);
        if (windowInfo) return this.#updateWindowInfo(windowInfo);
        const app = this.#windowTracker?.get_window_app(window);
        if (!app) return;
        this.#addWindowInfo(window, app);
        this.tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.Window} window
     * @param {Shell.App} app
     */
    #addWindowInfo(window, app) {
        if (!this.#windows) return;
        const windowInfo = new WindowInfo(window, app);
        this.#windows.set(window, windowInfo);
        this.#addAppWindow(windowInfo);
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    #addAppWindow(windowInfo) {
        if (!this.#apps) return;
        const { window, app } = windowInfo;
        const appWindows = this.#apps.get(app);
        if (!appWindows) this.#apps.set(app, new Set([window]));
        else appWindows.add(window);
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
        const windowInfo = this.#windows.get(window);
        if (!windowInfo) return;
        const { app, isValid } = windowInfo;
        if (isValid) return this.#updateWindowInfo(windowInfo);
        this.#removeWindowInfo(window);
        if (!this.#apps?.has(app)) return;
        const windows = this.#apps.get(app);
        windows?.delete(window);
        if (!windows?.size) this.#apps.delete(app);
        this.tracker?.trackAppChange(app);
    }

    /**
     * @param {Meta.Window} window
     */
    #removeWindowInfo(window) {
        if (!this.#windows) return;
        this.#windows.delete(window);
        if (this.#focusedWindowInfo?.window !== window) return;
        this.#focusedWindowInfo = null;
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    #updateWindowInfo(windowInfo) {
        if (this.isRouting) return this.#scheduleWindowRouting();
        if (windowInfo.isRouting) return;
        windowInfo.update(false);
        if (!windowInfo.isWorkspaceChanged) return;
        this.tracker?.trackAppChange(windowInfo.app);
    }

    /**
     * @param {Meta.Window} window
     */
    #handleWindowAttention(window) {
        if (!this.#windowTracker || !this.#config ||
            window instanceof Meta.Window === false || window.has_focus()) return;
        const app = this.#windowTracker.get_window_app(window);
        if (!app) return;
        const behavior = AppConfigValue(app.id, this.#appConfig, this.#config, ConfigKey.AttentionBehavior);
        switch (behavior) {
            case AttentionBehavior.FocusActive:
                const focusedWindow = global.display.get_focus_window();
                const appWindows = app.get_windows();
                const isActive = !!focusedWindow && new WeakSet(appWindows).has(focusedWindow);
                if (!isActive) return;
            case AttentionBehavior.FocusWorkspace:
                if (window.get_workspace() !== this.workspace) return;
            case AttentionBehavior.FocusAll:
                FocusedWindow(window);
        }
    }

    /**
     * @param {Meta.WindowActor} windowActor
     */
    #handleWindowMinimizedState(windowActor) {
        if (!windowActor || !this.#windows || !this.tracker) return;
        const window = windowActor.get_meta_window();
        if (!window) return;
        const windowInfo = this.#windows.get(window);
        const app = windowInfo?.app;
        if (!app) return;
        const event = window.minimized ? TaskbarEvent.Minimize : TaskbarEvent.Unminimize;
        this.tracker.routeAppEvent(app, event);
    }

    /**
     * @param {MessageTraySource} source
     * @param {*} notification
     */
    #handleAppNotification(source, notification) {
        if (!this.#config || !source || source._inDestruction) return;
        const { app, isAttentionSource } = NotificationSourceInfo(source, this.#windowTracker);
        const appId = app?.id;
        if (typeof appId !== 'string') return;
        const configKey = isAttentionSource ? ConfigKey.AttentionNotificationsBehavior :
                                              ConfigKey.NotificationsBehavior;
        const behavior = AppConfigValue(appId, this.#appConfig, this.#config, configKey);
        switch (behavior) {
            case NotificationsBehavior.Disable:
                Context.jobs.removeAll(source).new(source).destroy(() =>
                !source._inDestruction && source.destroy());
                return;
            case NotificationsBehavior.Hide:
            case NotificationsBehavior.Show:
            case NotificationsBehavior.Critical:
                const value = behavior !== NotificationsBehavior.Hide;
                if (source.policy.showBanners === value) return;
                const propertyDescriptor = { value, writable: true };
                Object.defineProperty(source.policy, Property.ShowBanners, propertyDescriptor);
                if (!notification || behavior !== NotificationsBehavior.Critical) return;
                notification.urgency = Urgency.CRITICAL;
        }
    }

    #updateClientAppsAndWindows() {
        if (!this.#config || !this.#windows || !this.#apps ||
            !this.clientApps || !this.clientAppWindows) return;
        const { isolateWorkspaces, showAllWindows } = this.#config;
        this.clientApps.clear();
        this.clientAppWindows.clear();
        if (!isolateWorkspaces && showAllWindows) {
            this.clientApps = new Set(this.#apps.keys());
            this.clientAppWindows = new Map([...this.#apps]);
            return;
        }
        for (const [window, windowInfo] of this.#windows) {
            const { app } = windowInfo;
            if (!app) continue;
            if (!showAllWindows && window.is_skip_taskbar()) continue;
            if (isolateWorkspaces && window.get_workspace() !== this.workspace) continue;
            this.clientApps.add(app);
            if (this.clientAppWindows.has(app)) this.clientAppWindows.get(app)?.add(window);
            else this.clientAppWindows.set(app, new Set([window]));
        }
    }

    #scheduleWindowRouting() {
        if (!this.#windows?.size) return this.#stopWindowRouting();
        this.#isRouting = true;
        if (!this.#routingHelper) this.#createRoutingHelper();
        Context.jobs.removeAll(this).new(this, DEFAULT_ROUTING_DELAY).destroy(() =>
        this.#startWindowRouting());
    }

    /**
     * Note: To correctly process monitor and workspace changes,
     *       all windows must be visible on the screen.
     *       Otherwise, some events may not be triggered.
     *       This function creates invisible window clones
     *       to ensure that all events are triggered.
     */
    #createRoutingHelper() {
        if (!this.#windows?.size || this.#routingHelper) return;
        this.#routingHelper = new Clutter.Actor(RoutingHelperProps);
        Context.desktop.addOverlay(this.#routingHelper);
        for (const [window, windowInfo] of this.#windows) {
            const { app } = windowInfo;
            const name = `${this.#routingHelper.name}-WindowClone_${app.id}`;
            const clone = new WindowPreview(window, name).setSize(1, 1);
            this.#routingHelper.add_child(clone.actor);
        }
    }

    #startWindowRouting() {
        this.#isRouting = false;
        if (!this.#windows?.size) return;
        for (const [_, windowInfo] of this.#windows) {
            if (this.#routeWindow(windowInfo)) continue;
            windowInfo.update();
        }
        Context.jobs.new(this, DEFAULT_ROUTING_DELAY).destroy(() =>
            (this.#stopWindowRouting(), this.tracker?.trackAll()));
    }

    #stopWindowRouting() {
        this.#isRouting = false;
        this.#routingHelper?.destroy();
        this.#routingHelper = null;
    }

    /**
     * @param {WindowInfo} windowInfo
     * @returns {boolean}
     */
    #routeWindow(windowInfo) {
        if (!this.#config?.windowRouting) return false;
        const { app } = windowInfo;
        const targetMonitor = AppConfigValue(app.id, this.#appConfig, this.#config, ConfigKey.PreferredMonitor);
        if (typeof targetMonitor !== 'string') return false;
        const isRouting = windowInfo.startRouting(targetMonitor);
        if (!isRouting) return false;
        const monitor = windowInfo.routeToMonitor();
        if (typeof monitor !== 'number') windowInfo.routeToWorkspace();
        windowInfo.updateMonitor(monitor).updateWorkspace();
        return true;
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
        TaskbarClient.#service.tracker?.addClient(this, callback);
    }

    destroy() {
        TaskbarClient.#service?.tracker?.removeClient(this);
        this.#app = null;
        if (!TaskbarClient.#service?.destroy()) return;
        TaskbarClient.#service = null;
    }

    /**
     * @param {ActivationBehavior?} [behavior]
     */
    activate(behavior = null) {
        if (!this.#app || !TaskbarClient.#service) return;
        TaskbarClient.#service.activate(this.#app, behavior);
    }

}
