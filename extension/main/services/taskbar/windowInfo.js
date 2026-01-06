/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('../../../shared/enums/taskbar.js').PreferredMonitor} PreferredMonitor
 */

import Context from '../../core/context.js';

export default class WindowInfo {

    /** @type {number} */
    #workspace;

    /** @type {number} */
    #oldWorkspace;

    /** @type {string?} */
    #monitor = null;

    /** @type {number?} */
    #targetWorkspace = null;

    /** @type {string?} */
    #targetMonitor = null;

    /** @type {Meta.Window} */
    window;

    /** @type {Shell.App} */
    app;

    /** @type {boolean} */
    get isValid() {
        const workspace = this.window.get_workspace()?.index() ?? -1;
        return workspace >= 0 ||
               new WeakSet(this.app.get_windows()).has(this.window);
    }

    /** @type {boolean} */
    get isWorkspaceChanged() {
        return this.#workspace !== this.#oldWorkspace;
    }

    /** @type {boolean} */
    get isRouting() {
        return typeof this.#targetMonitor === 'string' ||
               typeof this.#targetWorkspace === 'number';
    }

    /**
     * @param {Meta.Window} window
     * @param {Shell.App} app
     */
    constructor(window, app) {
        this.window = window;
        this.app = app;
        this.#workspace = window.get_workspace()?.index() ?? -1;
        this.#oldWorkspace = this.#workspace;
    }

    /**
     * @param {PreferredMonitor} monitor
     * @returns {boolean}
     */
    startRouting(monitor) {
        const windowMonitor = this.window.get_monitor() ?? -1;
        const windowWorkspace = this.window.get_workspace()?.index() ?? -1;
        if (windowMonitor < 0 || windowWorkspace < 0) return false;
        const monitors = Context.monitors;
        const preferredMonitor = monitors.getMonitorIndex(monitor);
        const windowLastMonitor = this.#monitor ? monitors.getMonitorIndex(this.#monitor) : -1;
        const targetMonitor = windowLastMonitor >= 0 ? windowLastMonitor :
                              preferredMonitor >= 0 ? preferredMonitor : windowMonitor;
        const targetWorkspace = this.#workspace >= 0 &&
                                this.#workspace !== windowWorkspace ? this.#workspace : windowWorkspace;
        this.#targetMonitor = windowMonitor !== targetMonitor ? monitors.getMonitor(targetMonitor) : null;
        this.#targetWorkspace = windowWorkspace !== targetWorkspace ? targetWorkspace : null;
        return typeof this.#targetMonitor === 'string' ||
               typeof this.#targetWorkspace === 'number';
    }

    /**
     * @returns {number?}
     */
    routeToMonitor() {
        if (typeof this.#targetMonitor !== 'string') return null;
        const monitors = Context.monitors;
        const targetMonitor = monitors.getMonitorIndex(this.#targetMonitor);
        const windowMonitor = this.window.get_monitor();
        const monitor = targetMonitor >= 0 ? targetMonitor : windowMonitor;
        this.#targetMonitor = null;
        if (monitor < 0 || monitor === windowMonitor) return null;
        this.window.move_to_monitor(monitor);
        return monitor;
    }

    routeToWorkspace() {
        if (typeof this.#targetWorkspace !== 'number') return;
        this.window.change_workspace_by_index(this.#targetWorkspace, true);
        this.#targetWorkspace = null;
    }

    /**
     * @param {boolean} [isMonitorUpdateRequired]
     * @returns {this}
     */
    update(isMonitorUpdateRequired = true) {
        this.updateWorkspace();
        if (!this.#monitor &&
            !isMonitorUpdateRequired) return this;
        this.updateMonitor();
        return this;
    }

    /**
     * @returns {this}
     */
    updateWorkspace() {
        this.#oldWorkspace = this.#workspace;
        this.#workspace = this.window.get_workspace()?.index() ?? -1;
        return this;
    }

    /**
     * @param {number?} [monitor]
     * @returns {this}
     */
    updateMonitor(monitor) {
        const monitors = Context.monitors;
        if (!monitors.hasMultipleMonitors) return this;
        monitor ??= this.window.get_monitor();
        this.#monitor = monitors.getMonitor(monitor);
        return this;
    }

}
