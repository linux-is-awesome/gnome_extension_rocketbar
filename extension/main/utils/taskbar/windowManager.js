
/**
 * @typedef {import('gi://Meta').Window} Meta.Window
 * @typedef {import('gi://Mtk').Rectangle} Mtk.Rectangle
 * @typedef {import('../../services/taskbar.js').TaskbarClient} TaskbarClient
 * @typedef {import('../../ui/base/component.js').Component} Component
 */

import { activateWindow as FocusedWindow } from 'resource:///org/gnome/shell/ui/main.js';
import { Overview } from '../../core/shell.js';
import Context from '../../core/context.js';
import { Delay } from '../../../shared/enums/general.js';

class CycleWindowsQueue {

    /** @type {Meta.Window[]?} */
    #windows = null;

    /** @type {boolean} */
    #minimize = true;

    /** @type {Meta.Window?} */
    #focusedWindow = null;

    /**
     * @param {Meta.Window[]} windows
     * @param {boolean} [minimize]
     * @param {boolean} [reverse]
     */
    next(windows, minimize = true, reverse = false) {
        this.#validate(windows);
        if (!this.#windows || minimize !== this.#minimize) {
            this.#windows = [...windows];
        }
        this.#minimize = minimize;
        let nextWindow = windows[0];
        if (!nextWindow.minimized) {
            let windowIndex = this.#windows.indexOf(nextWindow);
            const size = this.#windows.length;
            if (reverse) windowIndex--;
            else windowIndex++;
            if (windowIndex === size) {
                windowIndex = 0;
            } else if (windowIndex < 0) {
                windowIndex = size - 1;
            }
            nextWindow = this.#windows[windowIndex];
            if (!nextWindow) return;
        }
        if (!minimize || nextWindow.minimized || nextWindow !== this.#windows[0]) {
            this.#focusedWindow = nextWindow;
            return FocusedWindow(nextWindow);
        }
        for (const window of windows) {
            if (!window.can_minimize()) continue;
            window.minimize();
        }
        this.#reset();
    }

    destroy() {
        this.#reset();
    }

    /**
     * @param {Meta.Window[]} windows
     */
    #validate(windows) {
        if (!this.#windows) return;
        if (this.#windows.length !== windows.length) return this.#reset();
        const newWindows = new WeakSet(windows);
        if (this.#focusedWindow && (!newWindows.has(this.#focusedWindow) ||
                                    !this.#focusedWindow.has_focus())) return this.#reset();
        for (const window of this.#windows) {
            if (newWindows.has(window)) continue;
            return this.#reset();
        }
    }

    #reset() {
        this.#focusedWindow = null;
        this.#windows = null;
    }

}

export class WindowManager {

    /** @type {TaskbarClient?} */
    #service = null;

    /** @type {Component?} */
    #anchor = null;

    /** @type {Set<Meta.Window>?} */
    #windows = null;

    /** @type {CycleWindowsQueue?} */
    #queue = null;

    /** @type {boolean} */
    #hasFocus = false;

    /** @type {number} */
    #cyclePauseTimestamp = Date.now();

    /** @type {[windowsByWorkspace: Map<number, Meta.Window[]>, workspaceWindows?: Meta.Window[]]} */
    get #sortedWindows() {
        if (!this.#service || !this.#windows?.size) return [new Map(), []];
        const currentWorkspace = this.#service?.workspace?.index() ?? -1;
        /** @type {Map<number, Meta.Window[]>} */
        const windowsByWorkspace = new Map();
        const windows = this.#service.app?.get_windows() ?? [...this.#windows];
        for (const window of windows) {
            if (!this.#windows.has(window)) continue;
            const workspace = window.get_workspace();
            if (!workspace) continue;
            const workspaceIndex = workspace.index();
            const workspaceWindows = windowsByWorkspace.get(workspaceIndex);
            if (workspaceWindows) workspaceWindows.push(window);
            else windowsByWorkspace.set(workspaceIndex, [window]);
        }
        return [windowsByWorkspace, windowsByWorkspace.get(currentWorkspace)];
    }

    /** @type {Meta.Window?} */
    get activeWindow() {
        if (!this.#service || !this.#windows?.size) return null;
        const windows = this.#service.app?.get_windows();
        return windows?.find(window => this.#windows?.has(window)) ?? null;
    }

    /** @type {Set<Meta.Window>?} */
    get list() {
        return this.#windows;
    }

    /** @type {number} */
    get size() {
        return this.#windows?.size ?? 0;
    }

    /** @param {boolean} value */
    set hasFocus(value) {
        this.#hasFocus = value;
    }

    /**
     * @param {TaskbarClient} service
     * @param {Component?} [anchor]
     */
    constructor(service, anchor) {
        this.#service = service;
        this.#anchor = anchor ?? null;
    }

    destroy() {
        this.resetQueue();
        this.#service = null;
        this.#windows = null;
        this.#anchor = null;
    }

    update() {
        this.#windows = this.#service?.windows ?? null;
        if (!this.#windows || !this.#anchor) return;
        for (const window of this.#windows) {
            window.get_icon_geometry = () => this.#getWindowIconGeometry(window);
        }
    }

    /**
     * @param {boolean} [closeAll]
     */
    close(closeAll = false) {
        const [_, windows] = this.#sortedWindows;
        if (!windows?.length) return;
        const timestamp = global.get_current_time();
        const size = windows.length;
        if (!closeAll || size === 1) {
            const window = windows[0];
            this.#raiseWindow(window);
            window.delete(timestamp);
            return;
        }
        for (let i = size - 1; i >= 0; --i) this.#raiseWindow(windows[i]);
        for (let i = 0; i < size; ++i) windows[i].delete(timestamp + i);
    }

    minimize() {
        const [_, windows] = this.#sortedWindows;
        if (!windows?.length) return;
        this.resetQueue();
        for (const window of windows) window.minimize();
    }

    raise() {
        const [windowsByWorkspace, workspaceWindows] = this.#sortedWindows;
        if (!windowsByWorkspace.size) return;
        const windows = workspaceWindows ?? [...windowsByWorkspace.values()][0];
        if (!windows.length) return;
        for (let i = windows.length - 1; i >= 0; --i) this.#raiseWindow(windows[i]);
        if (!this.#hasFocus) this.#focusPrimaryWindow(windows);
        else FocusedWindow(windows[0]);
    }

    /**
     * @param {boolean} [minimize]
     * @param {boolean} [reverse]
     * @param {boolean} [pause]
     */
    cycle(minimize = true, reverse = false, pause = false) {
        const timestamp = Date.now();
        if (pause && timestamp - this.#cyclePauseTimestamp <= Delay.Sleep) return;
        this.#cyclePauseTimestamp = timestamp;
        const [windowsByWorkspace, workspaceWindows] = this.#sortedWindows;
        if (!windowsByWorkspace.size) return this.resetQueue();
        let windows = workspaceWindows ?? [...windowsByWorkspace.values()][0];
        if (!windows.length) return;
        const hasNoActiveWindows = Overview.visible || (!this.#hasFocus && !this.#queue);
        if (hasNoActiveWindows) return this.#focusPrimaryWindow(windows);
        for (const [_, otherWindows] of windowsByWorkspace) {
            if (otherWindows === workspaceWindows) continue;
            windows = !this.#hasFocus ? [...otherWindows, ...windows] : [...windows, ...otherWindows];
        }
        this.#queue ??= new CycleWindowsQueue();
        this.#queue.next(windows, minimize, reverse);
    }

    resetQueue() {
        this.#queue?.destroy();
        this.#queue = null;
    }

    /**
     * @param {Meta.Window[]} windows
     */
    #focusPrimaryWindow(windows) {
        this.resetQueue();
        const recentWindow = windows[0];
        if (!this.#anchor || windows.length === 1) return FocusedWindow(recentWindow);
        const monitor = Context.monitors.getMonitorIndex(this.#anchor.rect);
        const primaryWindow = windows.find(window => window.get_monitor() === monitor) ?? recentWindow;
        FocusedWindow(primaryWindow);
    }

    /**
     * @param {Meta.Window} window
     */
    #raiseWindow(window) {
        if (window.minimized) window.unminimize();
        window.raise_and_make_recent_on_workspace(window.get_workspace());
    }

    /**
     * @param {Meta.Window} window
     * @returns {[success: boolean, geometry: ?Mtk.Rectangle]}
     */
    #getWindowIconGeometry(window) {
        if (!window) return [false, null];
        if (this.#anchor) return [true, this.#anchor.rect];
        window.get_icon_geometry = window.constructor.prototype.get_icon_geometry;
        return window.get_icon_geometry();
    }

}
