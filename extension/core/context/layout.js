/* exported LayoutManager */

import { Main } from '../legacy.js';
import { Context } from '../context.js';
import { Type, Event, Delay } from '../enums.js';

export class LayoutManager {

    /** @type {Map<*, () => void>} */
    #clients = new Map();

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
        Context.jobs.removeAll(this).new(this, Delay.Background).destroy(() => this.#handleAfterInit());
    }

    /**
     * @param {*} client
     * @returns {boolean}
     */
    hasClient(client) {
        return this.#clients?.has(client); 
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
    requestParent(...args) {
        // TODO
    }

    #initClients() {
        if (!this.#clients?.size) return;
        Context.signals.removeAll(this);
        for (const [client, callback] of this.#clients) {
            this.#clients.set(client, null);
            if (typeof callback === Type.Function) callback();
        }
    }

    #handleAfterInit() {
        if (!this.#clients?.size) return;
        const callbacks = [...this.#clients.values()];
        this.#clients.clear();
        for (let i = 0, l = callbacks.length; i < l; ++i) {
            if (typeof callbacks[i] !== Type.Function) continue;
            callbacks[i]();
        }
    }

}
