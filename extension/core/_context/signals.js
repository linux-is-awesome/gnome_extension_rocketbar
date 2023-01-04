/* exported Signals */

const Extension = imports.ui.extensionSystem.rocketbar;

const { Type } = Extension.imports.core.enums;

var Signals = class {

    /** @type {Map<Object, Map<String, Array>>} */
    #connections = new Map();

    destroy() {
        if (!this.#connections) return;
        for (const [_, connections] of this.#connections) this.#disconnectAll(connections);
        this.#connections.clear();
    }

    /**
     * @param {Object} source 
     * @param {Array<Array<Object>>} scope [[target, [event,...], callback],...]
     * @returns {Signals} self
     */
    add(source, scope) {
        if (!this.#isValid(source, scope)) return this;
        const connections = this.#connections.get(source) || new Map();
        for (let i = 0, l = scope.length; i < l; ++i) this.#add(connections, scope[i]);
        if (connections.size) this.#connections.set(source, connections);
        return this;
    }

    /**
     * @param {Object} source 
     * @param {Array<String>} events
     * @returns {Signals} self
     */
    remove(source, events) {
        if (!this.#isValid(source, events)) return this;
        const connections = this.#connections.get(source);
        if (!connections) return this;
        for (let i = 0, l = events.length; i < l; ++i) {
            const event = events[i];
            if (!connections.has(event)) continue; 
            const [target, id] = connections.get(event);
            if (typeof target?.disconnect === Type.Function) target.disconnect(id);
            connections.delete(event);
        }
        if (!connections.size) this.#connections.delete(source);
        return this;
    }

    /**
     * @param {Object} source 
     * @returns {Signals} self
     */
    removeAll(source) {
        if (!this.#connections || !source) return this;
        const connections = this.#connections.get(source);
        if (!connections) return this;
        this.#disconnectAll(connections);
        this.#connections.delete(source);
        return this;
    }

    /**
     * @param {Map<String, Array>} connections
     * @param {Array<Object>} scope [target, [event,...], callback]
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
     * @param {Map<String, Array>} connections
     */
    #disconnectAll(connections) {
        for (const [_, [target, id]] of connections) {
            if (typeof target?.disconnect !== Type.Function) continue;
            target.disconnect(id);
        }
    }

    /**
     * @param {Object} source 
     * @param {Array} scope
     * @returns {Boolean}
     */
    #isValid(source, scope) {
        return this.#connections && source && Array.isArray(scope) && scope.length > 0;
    }
}
