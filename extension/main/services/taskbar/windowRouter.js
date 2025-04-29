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
import { PreferredMonitor } from '../../utils/taskbar/appConfig.js';
import { Event, Delay } from '../../../shared/core/enums.js';
import { Label } from '../../../shared/core/labels.js';

const STORAGE_KEY_MONITORS = 'monitors';
const DISPLAY_CHANGE_DIALOG_CLASS = 'DisplayChangeDialog';

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

    /** @type {PreferredMonitor?} */
    #preferredMonitor = null;

    /** @type {Job?} */
    #job = Context.jobs.new(this);

    /** @type {boolean} */
    get #hasMultipleMonitors() {
        return this.#monitors.size > 1;
    }

    /** @type {boolean} */
    get isRouting() {
        return this.#isRouting;
    }

    /** @param {PreferredMonitor} value */
    set preferredMonitor(value) {
        this.#preferredMonitor = value;
    }

    /** @param {{[appId: string]: {[key: string]: *}}} value */
    set appConfig(value) {
        this.#appConfig = value;
    }

    /**
     * @param {Map<Meta.Window, WindowInfo>} windows
     */
    constructor(windows) {
        this.#windows = windows;
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
        this.#appConfig = null;
    }

    restore() {
        if (this.#isRouting || !this.#isRoutingQueued || !this.#job) return;
        this.#isRouting = true;
        this.#job.reset(Delay.Queue).queue(() => this.#start());
    }

    /**
     * @param {WindowInfo} windowInfo
     */
    route(windowInfo) {
        if (!windowInfo) return;
        const { app, window, workspace, monitor } = windowInfo;
        if (!window) return;
        const windowMonitor = window.get_monitor();
        const windowWorkspace = window.get_workspace()?.index() ?? -1;
        if (windowMonitor < 0 || windowWorkspace < 0) return;
        const appId = app?.id;
        const appConfig = appId && this.#appConfig ? this.#appConfig[appId] : null;
        const preferredMonitorKey = appConfig?.preferredMonitor || this.#preferredMonitor;
        const preferredMonitor = typeof preferredMonitorKey === 'string' ?
                                 this.#monitors.get(preferredMonitorKey) : null;
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
        storage.clear();
        if (!oldMonitors) return;
        if (oldMonitors.length <= 1 &&
            oldMonitors.length === MainLayout.monitors?.length) return;
        this.#isRoutingQueued = oldMonitors !== MainLayout.monitors;
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
            Context.signals.remove(this, Overview);
            const activeModalDialog = Context.desktop.activeModalDialog;
            const isDisplayChangeDialog = activeModalDialog?.constructor?.name === DISPLAY_CHANGE_DIALOG_CLASS;
            if (!isDisplayChangeDialog) return this.#evaluateMonitorChanges();
            Context.signals.add(this, [activeModalDialog, Event.Closed, () => (
            Context.signals.remove(this, activeModalDialog),
            this.#evaluateMonitorChanges())]);
        });
    }

    /**
     * Note: We need to handle monitor index swapping (e.g., primary 1 -> 0, right 0 -> 1)
     *       to correctly restore windows afterwards.
     */
    #saveWindows() {
        if (!this.#windows?.size) return;
        const hasMultipleMonitors = this.#hasMultipleMonitors;
        const monitors = new Map();
        if (hasMultipleMonitors) {
            const display = global.display;
            const primaryMonitor = display.get_primary_monitor();
            monitors.set(primaryMonitor, PreferredMonitor.Primary);
            for (const monitor in MonitorDirection) {
                const direction = MonitorDirection[monitor];
                const index = display.get_monitor_neighbor_index(primaryMonitor, direction);
                if (index < 0) continue;
                monitors.set(index, monitor);
            }
        }
        for (const [window, windowInfo] of this.#windows) {
            windowInfo.hasFocus = window.has_focus();
            if (!hasMultipleMonitors) continue;
            const windowMonitor = window.get_monitor();
            windowInfo.monitor = monitors.get(windowMonitor) ?? null;
        }
    }

    #evaluateMonitorChanges() {
        const hadMultipleMonitors = this.#hasMultipleMonitors;
        this.#updateMonitors();
        this.#isRouting = hadMultipleMonitors || this.#hasMultipleMonitors || !!this.#status;
        this.#start();
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
        if (!this.#isRouting) return;
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
        if (!this.#isRouting) return;
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

    /**
     * Note: Let's not show the status when another modal is displayed on the screen to avoid conflicts.
     */
    #showStatus() {
        if (this.#status || Context.desktop.activeModalDialog) return;
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

}
