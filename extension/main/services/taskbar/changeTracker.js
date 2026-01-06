/**
 * @typedef {import('gi://Shell').App} Shell.App
 * @typedef {import('../../../shared/core/context/jobs.js').Jobs.Job} Job
 * @typedef {import('../taskbar.js').TaskbarClient} TaskbarClient
 */

import Context from '../../core/context.js';
import { TaskbarEvent } from '../taskbar.js';
import { Delay } from '../../../shared/enums/general.js';

export default class ChangeTracker {

    /** @type {boolean} */
    #isActive = false;

    /** @type {boolean} */
    #hasChangedApps = false;

    /** @type {Map<TaskbarClient, (event: TaskbarEvent) => void>?} */
    #clients = new Map();

    /** @type {Map<Shell.App, Set<TaskbarClient>>?} */
    #appClients = new Map();

    /** @type {WeakMap<Shell.App, TaskbarEvent>?} */
    #trackedApps = null;

    /** @type {Set<TaskbarClient>?} */
    #trackedClients = null;

    /** @type {((hasChangedApps: boolean) => void)?} */
    #callback = null;

    /** @type {Job?} */
    #job = Context.jobs.new(this);

    /** @type {boolean} */
    get isActive() {
        return this.#isActive;
    }

    /** @param {boolean} value */
    set isActive(value) {
        const oldIsActive = this.#isActive;
        this.#isActive = value;
        if (!this.#isActive || this.#isActive === oldIsActive) return;
        this.trackAll();
    }

    /** @type {boolean} */
    get hasClients() {
        return !!this.#clients?.size;
    }

    /**
     * @param {(hasChangedApps: boolean) => void} callback
     */
    constructor(callback) {
        this.#callback = callback;
    }

    destroy() {
        this.#isActive = false;
        this.#job?.destroy();
        this.#clients?.clear();
        this.#appClients?.clear();
        this.#trackedClients?.clear();
        this.#job = null;
        this.#callback = null;
        this.#trackedApps = null;
        this.#clients = null;
        this.#appClients = null;
        this.#trackedClients = null;
    }

    /**
     * @param {TaskbarClient} client
     * @param {(event: TaskbarEvent) => void} callback
     */
    addClient(client, callback) {
        if (!this.#appClients || !this.#clients) return;
        this.#clients.set(client, callback);
        const app = client.app;
        if (!app) return;
        const appClients = this.#appClients.get(app) ?? new Set();
        if (!appClients.size) this.#appClients.set(app, appClients);
        appClients.add(client);
    }

    /**
     * @param {TaskbarClient} client
     */
    removeClient(client) {
        if (!this.#clients?.has(client)) return;
        this.#clients.delete(client);
        const app = client.app;
        if (!app || !this.#appClients?.has(app)) return;
        const appClients = this.#appClients.get(app);
        appClients?.delete(client);
        if (appClients?.size) return;
        this.#appClients.delete(app);
    }

    /**
     * @param {number} [delay]
     * @param {boolean} [hasChangedApps]
     */
    trackAll(delay = Delay.Idle, hasChangedApps = true) {
        if (!this.#isActive || !this.#clients) return;
        this.#hasChangedApps ||= hasChangedApps;
        this.#trackedApps = null;
        this.#trackedClients = new Set(this.#clients.keys());
        this.#notifyClientsAsync(delay);
    }

    /**
     * @param {Shell.App} app
     */
    trackAppChange(app) {
        if (!this.#isActive || !this.#trackedApps || !this.#clients || !app) return;
        const isAlreadyTracked = this.#trackedApps.has(app);
        this.#hasChangedApps = true;
        this.#trackedApps.set(app, TaskbarEvent.Change);
        this.#trackedClients = new Set(this.#clients.keys());
        if (isAlreadyTracked) return;
        this.#notifyClientsAsync(Delay.Queue);
    }

    /**
     * @param {Shell.App?} [app]
     * @param {Shell.App?} [oldApp]
     */
    trackAppFocus(app = null, oldApp = null) {
        if (!this.#isActive || !this.#appClients || !this.#trackedApps) return;
        const appClients = app && !this.#trackedApps.has(app) ? this.#appClients.get(app) : null;
        if (app && appClients) this.#trackedApps.set(app, TaskbarEvent.Focus);
        const oldAppClients = oldApp && !this.#trackedApps.has(oldApp) ? this.#appClients.get(oldApp) : null;
        if (oldApp && oldAppClients) this.#trackedApps.set(oldApp, TaskbarEvent.Focus);
        if (!appClients && !oldAppClients) return;
        const clients = [...appClients ?? [], ...oldAppClients ?? []];
        this.#trackedClients = !this.#trackedClients?.size ? new Set(clients) :
                               new Set([...this.#trackedClients, ...clients]);
        this.#notifyClientsAsync();
    }

    /**
     * @param {Shell.App} app
     * @param {TaskbarEvent} event
     */
    routeAppEvent(app, event) {
        if (!app || !event || !this.#appClients) return;
        const clients = this.#appClients.get(app);
        if (!clients) return;
        const trackedClients = new Set([...clients]);
        const trackedApps = new Map([[app, event]]);
        this.#notifyClients(trackedClients, trackedApps, false);
    }

    /**
     * @param {number} [delay]
     */
    #notifyClientsAsync(delay = Delay.Idle) {
        if (!this.#job || !this.#clients?.size) return this.#untrackAll();
        this.#job.reset(delay).enqueue(() => (this.#notifyClients(), this.#untrackAll()));
    }

    /**
     * @param {Set<TaskbarClient>?} [clients]
     * @param {WeakMap<Shell.App, TaskbarEvent>?} [apps]
     * @param {boolean} [hasChangedApps]
     */
    #notifyClients(clients = this.#trackedClients, apps = this.#trackedApps, hasChangedApps = this.#hasChangedApps) {
        if (!clients?.size || !this.#callback) return;
        if (hasChangedApps) this.#callback(hasChangedApps);
        for (const client of clients) {
            const app = client.app ?? null;
            const event = app && apps ? apps.get(app) : TaskbarEvent.Change;
            if (!event) continue;
            const callback = this.#clients?.get(client);
            if (callback) callback(event);
        }
    }

    #untrackAll() {
        this.#hasChangedApps = false;
        this.#trackedApps = new WeakMap();
        this.#trackedClients?.clear();
        if (!this.#callback) return;
        this.#callback(this.#hasChangedApps);
    }
}
