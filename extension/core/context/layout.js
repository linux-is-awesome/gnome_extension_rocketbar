/* exported LayoutManager */

import { Main } from '../legacy.js';
import { Context } from '../context.js';
import { Type, Event, Delay } from '../enums.js';

export class LayoutManager {

    /** @type {Map<*, () => void>} */
    #clients = new Map();

    /** @type {boolean} */
    get isInitializing() {
        return this.#clients?.size > 0;
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.#clients = null;
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    requestInit(client, callback) {
        if (!this.#clients || !client ||
            typeof callback !== Type.Function ||
            typeof this.#clients.get(client) === Type.Function) return;
        if (!Context.isSessionStartingUp) {
            this.#clients.set(client, null);
            callback();
            return;
        }
        this.#clients.set(client, callback);
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [Main.layoutManager, Event.StartupComplete, () => this.#initClients()]);
    }

    /**
     * @param {*} client
     * @param {() => void} callback
     */
    queueAfterInit(client, callback) {
        if (!client || !this.#clients?.has(client) ||
            typeof callback !== Type.Function ||
            typeof this.#clients.get(client) === Type.Function) return;
        this.#clients.set(client, callback);
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#handleAfterInit()).catch();
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    isQueued(client) {
        return typeof this.#clients?.get(client) === Type.Function; 
    }

    /**
     * @param {*} client
     */
    removeClient(client) {
        if (!client || !this.#clients?.has(client)) return;
        this.#clients.delete(client);
        if (this.#clients.size) return;
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
    }

    /**
     * TODO: return target parent based on input params
     */
    requestParent(...args) {}

    #initClients() {
        this.#processClients();
        Context.signals.removeAll(this);
    }

    #handleAfterInit() {
        this.#processClients();
        this.#clients?.clear();
    }

    #processClients() {
        if (!this.#clients?.size) return;
        for (const [client, callback] of this.#clients) {
            this.#clients.set(client, null);
            if (typeof callback === Type.Function) callback();
        }
    }

}
