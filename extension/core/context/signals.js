/* exported Signals */

import { Type } from '../enums.js';

export class Signals {

    /** @type {Map<*, Set>} */
    #connections = new Map();

    destroy() {
        if (!this.#connections) return;
        for (const [client, connections] of this.#connections) this.#disconnectAll(client, connections);
        this.#connections = null;
    }

    /**
     * @param {*} client
     * @param {*[]} scope
     * @returns {this}
     */
    add(client, ...scope) {
        if (!this.#isValid(client, scope)) return this;
        const connections = this.#connections.get(client) ?? new Set();
        if (scope.length === 1) this.#add(client, connections, scope[0]);
        else for (let i = 0, l = scope.length; i < l; ++i) this.#add(client, connections, scope[i]);
        if (connections.size) this.#connections.set(client, connections);
        return this;
    }

    /**
     * @param {*} client
     * @param {*[]} targets
     * @returns {this}
     */
    remove(client, ...targets) {
        if (!this.#isValid(client, targets)) return this;
        const connections = this.#connections.get(client);
        if (!connections) return this;
        for (let i = 0, l = targets.length; i < l; ++i) {
            const target = targets[i];
            if (!connections.has(target)) continue; 
            if (typeof target?.disconnectObject === Type.Function) target.disconnectObject(client);
            connections.delete(target);
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
        this.#disconnectAll(client, connections);
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
     * @param {*} client
     * @param {Set} connections
     * @param {*[]} scope
     */
    #add(client, connections, scope) {
        if (!Array.isArray(scope) || !scope.length) return; 
        const [target] = scope.splice(0, 1);
        if (typeof target?.connectObject !== Type.Function) return;
        target.connectObject(...scope, client);
        connections.add(target);
    }

    /**
     * @param {Set} connections
     */
    #disconnectAll(client, connections) {
        for (const target of connections) {
            if (typeof target?.disconnectObject !== Type.Function) continue;
            target.disconnectObject(client);
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
