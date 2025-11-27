/**
 * @typedef {{event?: string?, callback?: ((...args) => *)?, flag?: number?}} TargetConnection
 * @typedef {Map<string, number>} TargetConnections
 */

import GObject from 'gi://GObject';
import Context from '../context.js';

const TARGET_SCOPE_MIN_LENGTH = 3;

export default class Signals {

    /** @type {Map<*, Map<*, TargetConnections>>?} client -> [target -> [event -> id]] */
    #connections = new Map();

    destroy() {
        if (!this.#connections) return;
        for (const [_, connections] of this.#connections) this.#disconnectAll(connections);
        this.#connections.clear();
        this.#connections = null;
    }

    /**
     * @param {*} client
     * @param {*[]} scope [target, event, callback,..., event, callback], [target,...]
     * @returns {this}
     */
    add(client, ...scope) {
        if (!this.#isValid(client, scope)) return this;
        const connections = this.#connections?.get(client) ?? new Map();
        if (scope.length === 1) this.#add(connections, scope[0]);
        else for (let i = 0, l = scope.length; i < l; ++i) this.#add(connections, scope[i]);
        if (connections.size) this.#connections?.set(client, connections);
        return this;
    }

    /**
     * @param {*} client
     * @param {*[]} targets
     * @returns {this}
     */
    remove(client, ...targets) {
        if (!this.#isValid(client, targets)) return this;
        const connections = this.#connections?.get(client);
        if (!connections) return this;
        for (let i = 0, l = targets.length; i < l; ++i) {
            const target = targets[i];
            if (!target || !connections.has(target)) continue;
            const targetConnections = connections.get(target);
            if (targetConnections?.size) this.#disconnectTarget(target, targetConnections);
            connections.delete(target);
        }
        if (!connections.size) this.#connections?.delete(client);
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
     * @returns {boolean}
     */
    has(client) {
        return this.#connections?.has(client) ?? false;
    }

    /**
     * @param {Map<*, TargetConnections>} connections
     * @param {*[]} scope
     */
    #add(connections, scope) {
        if (!Array.isArray(scope) || scope.length < TARGET_SCOPE_MIN_LENGTH) return;
        const [target] = scope.splice(0, 1);
        if (typeof target?.connect !== 'function') return;
        const targetConnections = connections.get(target) ?? new Map();
        /** @type {TargetConnection?} */
        let connection = null;
        for (const param of scope) {
            switch (typeof param) {
                case 'string':
                    if (connection) this.#connectTarget(target, targetConnections, connection);
                    connection = { event: param };
                    break;
                case 'function':
                    if (connection?.event) {
                        connection.callback = param;
                        break;
                    }
                case 'number':
                    if (connection?.callback) {
                        connection.flag = param;
                        break;
                    }
                default:
                    connection = null;
            }
        }
        if (connection) this.#connectTarget(target, targetConnections, connection);
        if (targetConnections.size) connections.set(target, targetConnections);
    }

    /**
     * @param {Map<*, TargetConnections>} connections
     */
    #disconnectAll(connections) {
        for (const [target, targetConnections] of connections) {
            this.#disconnectTarget(target, targetConnections);
        }
    }

    /**
     * Note: Multiple connections to the same event are not currently supported and will be ignored.
     *
     * @param {*} target
     * @param {TargetConnections} connections
     * @param {TargetConnection} connection
     */
    #connectTarget(target, connections, connection) {
        const { event, callback, flag } = connection;
        if (!event || !callback || connections.has(event)) return;
        try {
            const id = flag === GObject.ConnectFlags.AFTER &&
                       typeof target.connect_after === 'function' ?
                       target.connect_after(event, callback) :
                       typeof target.connect === 'function' ?
                       target.connect(event, callback) : null;
            if (typeof id === 'number') connections.set(event, id);
            else Context.logError(`${this.constructor.name} got invalid connection id (${id}) for event: ${event}.`);
        } catch (e) {
            Context.logError(`${this.constructor.name} failed to connect target.`, e);
        }
    }

    /**
     * @param {*} target
     * @param {TargetConnections} connections
     */
    #disconnectTarget(target, connections) {
        if (typeof target?.disconnect !== 'function') return;
        for (const [_, id] of connections) {
            if (typeof id !== 'number' && typeof id !== 'string') continue;
            try {
                target.disconnect(id);
            } catch (e) {
                Context.logError(`${this.constructor.name} failed to disconnect target.`, e);
            }
        }
    }

    /**
     * @param {*} client
     * @param {*[]} scope
     * @returns {boolean}
     */
    #isValid(client, scope) {
        return this.#connections && client && Array.isArray(scope) && !!scope.length;
    }

}
