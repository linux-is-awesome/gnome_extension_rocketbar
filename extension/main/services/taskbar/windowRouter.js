/**
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('resource:///org/gnome/shell/ui/modalDialog.js').ModalDialog} ModalDialog
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 * @typedef {import('../taskbar.js').WindowInfo} WindowInfo
 */

import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { activateWindow as FocusedWindow,
         moveWindowToMonitorAndWorkspace as RoutedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import { ModalDialog } from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { MainLayout, Overview } from '../../core/shell.js';
import Context from '../../core/context.js';
import { Config, InnerConfig } from '../../../shared/utils/config.js';
import { PreferredMonitor } from '../../utils/taskbar/appConfig.js';
import { Event, Delay } from '../../../shared/core/enums.js';
import { Label } from '../../../shared/core/labels.js';

const CONFIG_PATH = 'taskbar';
const CONFIG_FIELD_APP_CONFIG = 'appConfig';
const STORAGE_KEY_MONITORS = 'monitors';

/** @type {{[value: string]: number}} */
const MonitorDirection = {
    [PreferredMonitor.Left]: Meta.DisplayDirection.LEFT,
    [PreferredMonitor.Right]: Meta.DisplayDirection.RIGHT,
    [PreferredMonitor.Above]: Meta.DisplayDirection.UP,
    [PreferredMonitor.Below]: Meta.DisplayDirection.DOWN
};

/** @type {{[prop: string]: *}} */
const StatusProps = {
    shouldFadeIn: false,
    destroyOnClose: true,
    styleClass: 'headline'
};

/** @type {{[prop: string]: *}} */
const StatusTextProps = {
    text: Label.PleaseWait,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER
};

/** @enum {string} */
const ConfigFields = {
    windowsPreferredMonitor: 'windows-preferred-monitor',
    [CONFIG_FIELD_APP_CONFIG]: 'appbutton-config-override'
};

export default class WindowRouter {

    /** @type {Map<string, number>} */
    #monitors = new Map();

    /** @type {Map<Meta.Window, WindowInfo>?} */
    #windows = null;

    /** @type {boolean} */
    #isRouting = false;

    /** @type {boolean} */
    #isRoutingQueued = false;

    /** @type {ModalDialog?} */
    #status = null;

    /** @type {{[appId: string]: {[key: string]: *}}?} */
    #appConfig = null;

    /** @type {Job?} */
    #job = Context.jobs.new(this);

    /** @type {Config?} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey), { path: CONFIG_PATH });

    /** @type {boolean} */
    get #hasMultipleMonitors() {
        return this.#monitors.size > 1;
    }

    /** @type {Map<number, string>} */
    get #monitorsByIndex() {
        const result = new Map();
        if (!this.#monitors.size) return result;
        for (const [direction, index] of this.#monitors) result.set(index, direction);
        return result;
    }

    /** @type {boolean} */
    get isRouting() {
        return this.#isRouting;
    }

    /**
     * @param {Map<Meta.Window, WindowInfo>} windows
     */
    constructor(windows) {
        this.#windows = windows;
        this.#handleConfig();
        this.#updateMonitors();
        this.#validateSession();
        Context.signals.add(this,
            [global.backend.get_monitor_manager(), Event.MonitorsChanged, () => this.#handleMonitors()]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#job?.destroy();
        this.#isRouting = false;
        this.#hideStatus();
        this.#saveSession();
        this.#windows = null;
        this.#job = null;
        this.#config = null;
        this.#appConfig = null;
    }

    recover() {
        if (this.#isRouting || !this.#isRoutingQueued) return;
        this.#isRouting = true;
        this.#job?.reset(Delay.Queue).queue(() => this.#start());
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    route(windowInfo) {
        if (!windowInfo) return;
        const { app, window, workspace, monitor } = windowInfo;
        if (!app || !window) return;
        const windowMonitor = window.get_monitor();
        const windowWorkspace = window.get_workspace().index();
        if (windowMonitor < 0 || windowWorkspace < 0) return;
        const appId = app.id;
        const appConfig = appId ? this.#appConfig?.[appId] : null;
        const preferredMonitorName = appConfig?.windowsPreferredMonitor ||
                                     this.#config?.windowsPreferredMonitor;
        const preferredMonitor = typeof preferredMonitorName === 'string' ?
                                 this.#monitors.get(preferredMonitorName) : null;
        const windowLastMonitor = typeof monitor === 'string' ?
                                  this.#monitors.get(monitor) : null;
        const targetMonitor = windowLastMonitor ?? preferredMonitor ?? windowMonitor;
        const targetWorkspace = typeof workspace === 'number' &&
                                workspace > windowWorkspace ? workspace : windowWorkspace;
        if (windowMonitor === targetMonitor &&
            windowWorkspace === targetWorkspace) return;
        windowInfo.monitor = null;
        RoutedWindow(window, targetMonitor, workspace, true);
    }

    #validateSession() {
        const storage = Context.getStorage(this.constructor.name);
        const oldMonitors = storage.get(STORAGE_KEY_MONITORS);
        if (!oldMonitors) return;
        storage.clear();
        this.#isRoutingQueued = MainLayout.monitors !== oldMonitors;
    }

    #saveSession() {
        if (!Context.desktop.isLocked) return;
        const storage = Context.getStorage(this.constructor.name);
        storage.set(STORAGE_KEY_MONITORS, MainLayout.monitors);
        this.#saveWindows();
    }

    #handleMonitors() {
        if (!this.#job) return;
        if (!this.#isRouting) this.#saveWindows();
        this.#isRouting = true;
        this.#job.reset(Delay.Queue).queue(() => {
            this.#updateMonitors();
            this.#start();
        });
    }

    #saveWindows() {
        if (!this.#windows?.size) return;
        const hasMultipleMonitors = this.#hasMultipleMonitors;
        const monitors = this.#monitorsByIndex;
        for (const [window, windowInfo] of this.#windows) {
            windowInfo.hasFocus = window.has_focus();
            if (!hasMultipleMonitors) continue;
            const windowMonitor = window.get_monitor();
            windowInfo.monitor = monitors.get(windowMonitor) ?? null;
        }
    }

    #updateMonitors() {
        this.#monitors.clear();
        const display = global.display;
        if (display.get_n_monitors() <= 1) return;
        const primaryMonitor = display.get_primary_monitor();
        this.#monitors.set(PreferredMonitor.Primary, primaryMonitor);
        for (const monitor in MonitorDirection) {
            const direction = MonitorDirection[monitor];
            const index = display.get_monitor_neighbor_index(primaryMonitor, direction);
            if (index < 0) continue;
            this.#monitors.set(monitor, index);
        }
    }

    #start() {
        this.#isRoutingQueued = false;
        if (!this.#windows?.size) {
            this.#isRouting = false;
            return;
        }
        this.#showStatus();
        Context.signals.add(this, [
            Overview,
            Event.OverviewShown, () => this.#execute(),
            Event.OverviewHidden, () => this.#finish()
        ]);
        if (!Overview.visible) return Overview.show();
        this.#execute();
    }

    #execute() {
        this.#job?.reset(Delay.Queue).queue(() => {
            if (!this.#isRouting || !this.#windows?.size) {
                return this.#finish();
            }
            const windowsInfo = this.#windows?.values() ?? [];
            let focusedWindow = null;
            for (const windowInfo of windowsInfo) {
                this.route(windowInfo);
                if (!windowInfo.hasFocus) continue;
                focusedWindow = windowInfo.window;
            }
            this.#finish(focusedWindow);
        });
    }

    /**
     * @param {Meta.Window?} [window]
     */
    #finish(window) {
        this.#isRouting = false;
        Context.signals.remove(this, Overview);
        this.#job?.reset(Delay.Scheduled).queue(() => {
            if (this.#isRouting) return;
            if (window && this.#windows?.has(window)) FocusedWindow(window);
            else if (Overview.visible) Overview.hide();
            this.#hideStatus();
        });
    }

    #showStatus() {
        if (this.#status) return;
        const text = new St.Label(StatusTextProps);
        this.#status = new ModalDialog(StatusProps);
        this.#status.buttonLayout?.hide();
        this.#status.contentLayout?.add_child(text);
        this.#status.open();
    }

    #hideStatus() {
        this.#status?.close();
        this.#status = null;
    }

    /**
     * @param {string?} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config) return;
        if (settingsKey && settingsKey !== ConfigFields.appConfig) return;
        this.#appConfig = InnerConfig(this.#config, CONFIG_FIELD_APP_CONFIG);
    }

}
