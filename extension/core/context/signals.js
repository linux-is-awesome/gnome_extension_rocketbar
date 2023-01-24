/* exported Signals */

import { Type } from '../enums.js';

export class Signals {

    /** @type {Map<*, Map<string, [target: *, id: number|string]>>} */
    #connections = new Map();

    destroy() {
        if (!this.#connections) return;
        for (const [_, connections] of this.#connections) this.#disconnectAll(connections);
        this.#connections = null;
    }

    /**
     * @param {*} client
     * @param {[[target: *, events: string[], callback: (...args) => *]]} scope
     * @returns {this}
     */
    add(client, scope) {
        if (!this.#isValid(client, scope)) return this;
        const connections = this.#connections.get(client) ?? new Map();
        for (let i = 0, l = scope.length; i < l; ++i) this.#add(connections, scope[i]);
        if (connections.size) this.#connections.set(client, connections);
        return this;
    }

    /**
     * @param {*} client
     * @param {string[]} events
     * @returns {this}
     */
    remove(client, events) {
        if (!this.#isValid(client, events)) return this;
        const connections = this.#connections.get(client);
        if (!connections) return this;
        for (let i = 0, l = events.length; i < l; ++i) {
            const event = events[i];
            if (!connections.has(event)) continue; 
            const [target, id] = connections.get(event);
            if (typeof target?.disconnect === Type.Function) target.disconnect(id);
            connections.delete(event);
        }
        if (!connections.size) this.#connections.delete(client);
        return this;
    }

    /**
     * @param {*} client
     * @returns {this}
     */
    removeAll(client) {
        if (!this.#connections || !client) return this;
        const connections = this.#connections.get(client);
        if (!connections) return this;
        this.#connections.delete(client);
        this.#disconnectAll(connections);
        return this;
    }

    /**
     * @param {*} client
     * @return {boolean}
     */
    hasClient(client) {
        return this.#connections?.has(client);
    }

    /**
     * @param {Map<string, [target: *, id: number|string]>} connections
     * @param {[target: *, events: string[], callback: (...args) => *]} scope
     */
    #add(connections, scope) {
        if (!Array.isArray(scope) || !scope.length) return; 
        const [target, events, callback] = scope;
        if (typeof target?.connect !== Type.Function ||
            typeof callback !== Type.Function ||
            !Array.isArray(events) || !events.length) return;
        for (let i = 0, l = events.length; i < l; ++i) {
            const event = events[i];
            if (typeof event !== Type.String || connections.has(event)) continue;
            connections.set(event, [target, target.connect(event, callback)]);
        }
    }

    /**
     * @param {Map<string, [target: *, id: number|string]>} connections
     */
    #disconnectAll(connections) {
        for (const [_, [target, id]] of connections) {
            if (typeof target?.disconnect !== Type.Function) continue;
            target.disconnect(id);
        }
    }

    /**
     * @param {*} client 
     * @param {Array} scope
     * @returns {boolean}
     */
    #isValid(client, scope) {
        return this.#connections && client && Array.isArray(scope) && scope.length > 0;
    }

}
