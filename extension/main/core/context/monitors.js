/**
 * @typedef {{index: number, x: number, y: number, width: number, height: number, geometry_scale: number}} MonitorInfo
 */

import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Context from '../context.js';
import { MainLayout } from '../../core/shell.js';
import { Monitor, Alignment, Event, Delay } from '../../../shared/enums/general.js';

/** @type {{[monitor: string]: number}} */
const MonitorDirection = {
    [Monitor.Left]: Meta.DisplayDirection.LEFT,
    [Monitor.Right]: Meta.DisplayDirection.RIGHT,
    [Monitor.Above]: Meta.DisplayDirection.UP,
    [Monitor.Below]: Meta.DisplayDirection.DOWN
};

export default class Monitors {

    /** @type {boolean} */
    #isUpdating = false;

    /** @type {Map<Monitor, number>} */
    #monitors = new Map();

    /** @type {Map<number, Monitor>} */
    #monitorsByIndex = new Map();

    /** @type {Map<*, () => void>?} */
    #clients = new Map();

    /** @type {MonitorInfo[]} */
    get list() {
        return MainLayout.monitors ?? [];
    }

    /** @type {boolean} */
    get hasMultipleMonitors() {
        return this.#monitors.size > 1;
    }

    /** @type {boolean} */
    get isUpdating() {
        return this.#isUpdating;
    }

    constructor() {
        this.#updateMonitors();
        Context.signals.add(this, [global.backend.get_monitor_manager(),
            Event.MonitorsChanged, () => this.#enqueueUpdate()]);
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.jobs.removeAll(this);
        this.#clients?.clear();
        this.#clients = null;
    }

    /**
     * @param {number} index
     * @returns {Monitor}
     */
    getMonitor(index) {
        return this.#monitorsByIndex.get(index) ?? Monitor.Primary;
    }

    /**
     * @param {Mtk.Rectangle?} rect
     * @returns {MonitorInfo?}
     */
    getMonitorInfo(rect) {
        const monitorIndex = this.getMonitorIndex(rect);
        return this.list[monitorIndex] ?? null;
    }

    /**
     * @param {Mtk.Rectangle?} rect
     * @returns {[x: Alignment, y: Alignment]}
     */
    getAlignment(rect) {
        const monitorIndex = this.getMonitorIndex(rect);
        const monitor = this.list[monitorIndex];
        if (!rect || !monitor) return [Alignment.Top, Alignment.Left];
        const x = rect.x < (monitor.x + monitor.width) / 2 ?
                  Alignment.Left : Alignment.Right;
        const y = rect.y < (monitor.y + monitor.height) / 2 ?
                  Alignment.Top : Alignment.Bottom;
        return [x, y];
    }

    /**
     * @param {(Mtk.Rectangle|Meta.DisplayDirection|Monitor)?} target
     * @param {number} [source]
     * @returns {number}
     */
    getMonitorIndex(target, source) {
        if (target instanceof Mtk.Rectangle) return global.display.get_monitor_index_for_rect(target);
        if (typeof target === 'string') return this.#monitors.get(target) ?? -1;
        if (typeof target !== 'number') return -1;
        source ??= global.display.get_primary_monitor();
        return global.display.get_monitor_neighbor_index(source, target);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    connect(client, callback) {
        if (!this.#clients || !client ||
            typeof callback !== 'function') return;
        this.#clients.set(client, callback);
    }

    /**
     * @param {*} client
     */
    disconnect(client) {
        this.#clients?.delete(client);
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    has(client) {
        return !!this.#clients?.has(client);
    }

    #enqueueUpdate() {
        this.#isUpdating = true;
        Context.jobs.replace(this, Delay.Queue).destroy(() => this.#update());
    }

    #update() {
        this.#updateMonitors();
        this.#notifyClients();
        this.#isUpdating = false;
    }

    #updateMonitors() {
        this.#monitors.clear();
        this.#monitorsByIndex.clear();
        const display = global.display;
        const primaryMonitor = display.get_primary_monitor();
        this.#monitors.set(Monitor.Primary, primaryMonitor);
        this.#monitorsByIndex.set(primaryMonitor, Monitor.Primary);
        if (display.get_n_monitors() <= 1) return;
        for (const monitor in MonitorDirection) {
            const direction = MonitorDirection[monitor];
            const index = display.get_monitor_neighbor_index(primaryMonitor, direction);
            if (index < 0) continue;
            this.#monitors.set(monitor, index);
            this.#monitorsByIndex.set(index, monitor);
        }
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const [_, callback] of this.#clients) callback();
    }

}
