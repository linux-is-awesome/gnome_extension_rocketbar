
/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('gi://Meta').Workspace} Meta.Workspace
 * @typedef {import('../../shared/core/context/signals.js').Signals.SignalTracker} SignalTracker
 * @typedef {import('../../shared/core/context/jobs.js').Jobs.Job} Job
 */

import Context from '../core/context.js';
import { AppWindow } from '../utils/appWindow.js';
import { Event, Delay } from '../../shared/enums/general.js';

class WindowMotionTrackingService {

    /** @type {Meta.Workspace?} */
    #workspace = null;

    /** @type {SignalTracker?} */
    #workspaceSignals = null;

    /** @type {Job?} */
    #job = Context.jobs.new(this, Delay.Queue);

    /** @type {Map<WindowMotionTracker, () => void>} */
    #clients = new Map();

    /** @type {Set<Meta.Window>} */
    windows = new Set();

    constructor() {
        Context.signals.add(this, [global.window_manager,
            Event.SwitchWorkspace, () => this.#untrackWorkspace()]);
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#clients.size) return false;
        Context.signals.removeAll(this);
        this.#job?.destroy();
        this.#job = null;
        this.#untrackWorkspace();
        return true;
    }

    /**
     * @param {WindowMotionTracker} client
     * @param {() => void} callback
     */
    addClient(client, callback) {
        this.#clients.set(client, callback);
        this.#enqueueUpdate();
    }

    /**
     * @param {WindowMotionTracker} client
     */
    removeClient(client) {
        this.#clients.delete(client);
    }

    #enqueueUpdate() {
        this.#job?.enqueue(() => this.#update(), false);
    }

    #update() {
        if (!this.#job) return;
        if (!this.#workspace) this.#trackWorkspace();
        for (const [_, callback] of this.#clients) callback();
    }

    #trackWorkspace() {
        if (this.#workspace) return;
        const workspace = global.workspace_manager.get_active_workspace();
        if (!workspace) return;
        this.#workspaceSignals ??= Context.signals.new();
        const windows = workspace.list_windows();
        for (const window of windows) this.#trackWindow(window);
        this.#workspace = workspace;
        this.#workspaceSignals.add([workspace,
            Event.WindowAdded, (_, window) => this.#trackWindow(window),
            Event.WindowRemoved, (_, window) => this.#untrackWindow(window)]);
    }

    #untrackWorkspace() {
        this.#workspaceSignals?.destroy();
        this.#workspaceSignals = null;
        this.#workspace = null;
        this.windows.clear();
        if (this.#job) this.#enqueueUpdate();
    }

    /**
     * @param {Meta.Window} window
     */
    #trackWindow(window) {
        if (!this.#workspaceSignals ||
            this.windows.has(window) || !AppWindow(window)) return;
        this.windows.add(window);
        const signalHandler = () => this.#enqueueUpdate();
        this.#workspaceSignals.add([window,
            Event.WindowMaximized, signalHandler,
            Event.WindowMinimized, signalHandler,
            Event.WindowPositionChanged, signalHandler,
            Event.WindowSizeChanged, signalHandler]);
        if (this.#workspace) this.#enqueueUpdate();
    }

    /**
     * @param {Meta.Window} window
     */
    #untrackWindow(window) {
        if (!this.#workspaceSignals || !this.windows.has(window)) return;
        this.windows.delete(window);
        this.#workspaceSignals.remove(window);
        if (this.#workspace) this.#enqueueUpdate();
    }

}

export class WindowMotionTracker {

    /** @type {WindowMotionTrackingService?} */
    static #service = null;

    /** @type {Set<Meta.Window>?} */
    get windows() {
        return WindowMotionTracker.#service?.windows ?? null;
    }

    /**
     * @param {() => void} callback
     */
    constructor(callback) {
        if (typeof callback !== 'function') return;
        WindowMotionTracker.#service ??= new WindowMotionTrackingService();
        WindowMotionTracker.#service.addClient(this, callback);
    }

    destroy() {
        WindowMotionTracker.#service?.removeClient(this);
        if (!WindowMotionTracker.#service?.destroy()) return;
        WindowMotionTracker.#service = null;
    }

}
