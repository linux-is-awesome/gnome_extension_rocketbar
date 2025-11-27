/**
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 * @typedef {{index: number, x: number, y: number, width: number, height: number, geometry_scale: number}} MonitorInfo
 */

import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import Context from '../context.js';
import { MainLayout } from '../../core/shell.js';
import { Monitor, Alignment, Event, Delay } from '../../../shared/core/enums.js';

/** @type {{[monitor: string]: number}} */
const MonitorDirection = {
    [Monitor.Left]: Meta.DisplayDirection.LEFT,
    [Monitor.Right]: Meta.DisplayDirection.RIGHT,
    [Monitor.Above]: Meta.DisplayDirection.UP,
    [Monitor.Below]: Meta.DisplayDirection.DOWN
};

export default class Monitors {

    /** @type {Map<Monitor, number>} */
    #monitors = new Map();

    /** @type {Map<*, () => void>?} */
    #clients = new Map();

    /** @type {Job?} */
    #job = Context.jobs.new(this, Delay.Queue);

    /** @type {MonitorInfo[]} */
    get list() {
        return MainLayout.monitors ?? [];
    }

    /** @type {boolean} */
    get hasMultipleMonitors() {
        return this.#monitors.size > 1;
    }

    constructor() {
        this.#updateMonitors();
        Context.signals.add(this,
            [global.backend.get_monitor_manager(), Event.MonitorsChanged, () => this.#handleMonitors()]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#job?.destroy();
        this.#clients?.clear();
        this.#job = null;
        this.#clients = null;
    }

    /**
     * @param {Mtk.Rectangle?} rect
     * @returns {MonitorInfo?}
     */
    getMonitor(rect) {
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
     * @param {(Mtk.Rectangle|Monitor)?} source
     * @returns {number}
     */
    getMonitorIndex(source) {
        if (source instanceof Mtk.Rectangle) return global.display.get_monitor_index_for_rect(source);
        return source ? this.#monitors.get(source) ?? -1 : -1;
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

    #handleMonitors() {
        if (!this.#job) return;
        this.#job.reset().enqueue(() => (this.#updateMonitors(), this.#notifyClients()));
    }

    #updateMonitors() {
        this.#monitors.clear();
        const display = global.display;
        const primaryMonitor = display.get_primary_monitor();
        this.#monitors.set(Monitor.Primary, primaryMonitor);
        if (display.get_n_monitors() <= 1) return;
        for (const monitor in MonitorDirection) {
            const direction = MonitorDirection[monitor];
            const index = display.get_monitor_neighbor_index(primaryMonitor, direction);
            if (index < 0) continue;
            this.#monitors.set(monitor, index);
        }
    }

    #notifyClients() {
        if (!this.#clients?.size) return;
        for (const [_, callback] of this.#clients) callback();
    }

}
