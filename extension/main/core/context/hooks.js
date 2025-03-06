import Context from '../context.js';

class Hook {

    /** @type {*} */
    #target = null;

    /** @type {((...args) => *)?} */
    #originFunction = null;

    /** @type {Map<*, (...args) => *>?} */
    #beforeClients = new Map();

    /** @type {Map<*, (...args) => *>?} */
    #afterClients = new Map();

    /** @type {boolean} */
    get isValid() {
        return typeof this.#originFunction === 'function';
    }

    /**
     * @param {*} target
     * @param {string} functionName
     */
    constructor(target, functionName) {
        const originFunction = target[functionName];
        if (typeof originFunction !== 'function') return;
        this.#target = target;
        this.#originFunction = originFunction;
        const beforeClientsCallback = (sender, args) => this.#executeBeforeClients(sender, args);
        const afterClientsCallback = (sender, result, args) => this.#executeAfterClients(sender, result, args);
        this.#target[functionName] = function (...args) {
            let result;
            [result, args] = beforeClientsCallback(this, args);
            if (typeof result !== 'undefined') return result;
            result = originFunction.call(this, ...args);
            result = afterClientsCallback(this, result, args) ?? result;
            return result;
        };
    }

    /**
     * @param {*} client
     * @param {(...args) => *} callback
     * @param {boolean} [isBefore]
     */
    addClient(client, callback, isBefore = false) {
        if (!this.#beforeClients || !this.#afterClients) return;
        const clients = isBefore ? this.#beforeClients : this.#afterClients;
        clients.set(client, callback);
    }

    /**
     * @param {*} client
     */
    removeClient(client) {
        if (!this.#beforeClients || !this.#afterClients) return;
        this.#beforeClients.delete(client);
        this.#afterClients.delete(client);
        if (!this.#beforeClients.size && !this.#afterClients.size) this.destroy();
    }

    destroy() {
        this.#beforeClients?.clear();
        this.#afterClients?.clear();
        this.#beforeClients = null;
        this.#afterClients = null;
        if (!this.#target || !this.#originFunction) return;
        this.#target[this.#originFunction.name] = this.#originFunction;
        this.#target = null;
        this.#originFunction = null;
    }

    /**
     * @param {*} sender
     * @param {*[]} args
     * @returns {*[]}
     */
    #executeBeforeClients(sender, args) {
        let result;
        if (!this.#originFunction || !this.#beforeClients) return [result, args];
        for (const [_, callback] of this.#beforeClients) {
            try {
                const callbackResult = callback(sender, ...args) ?? result;
                if (callbackResult === result) continue;
                if (Array.isArray(callbackResult)) {
                    if (!callbackResult.length) continue;
                    result = callbackResult.splice(0, 1)[0] ?? result;
                    if (!callbackResult.length) continue;
                    args = callbackResult;
                    continue;
                }
                result = callbackResult;
            } catch (e) {
                Context.logError(`${Hook.name}:before failed for function: ${this.#originFunction.name}.`, e);
            }
        }
        return [result, args];
    }

    /**
     * @param {*} sender
     * @param {*} originResult
     * @param {*[]} args
     * @returns {*}
     */
    #executeAfterClients(sender, originResult, args) {
        let result;
        if (!this.#originFunction || !this.#afterClients) return result;
        for (const [_, callback] of this.#afterClients) {
            try {
                result = callback(sender, originResult, ...args) ?? result;
            } catch (e) {
                Context.logError(`${Hook.name}:after failed for function: ${this.#originFunction.name}.`, e);
            }
        }
        return result;
    }

}

export default class Hooks {

    /** @type {Map<*, Map<string, Hook>>?} target -> [functionName -> hook] */
    #hooks = new Map();

    destroy() {
        if (!this.#hooks) return;
        for (const [_, hooks] of this.#hooks) {
            for (const [__, hook] of hooks) hook.destroy();
        }
        this.#hooks.clear();
        this.#hooks = null;
    }

    /**
     * @param {*} client
     * @param {*} target
     * @param {string|Function} method
     * @param {(...args) => *} callback
     * @param {boolean} [isBefore]
     */
    add(client, target, method, callback, isBefore = false) {
        if (!this.#hooks || !client || !target ||
            !method || typeof callback !== 'function') return;
        const functionName = typeof method === 'function' ?
                             method.name || this.#getFunctionName(target, method) :
                             method;
        if (typeof functionName !== 'string' ||
            typeof target[functionName] !== 'function') return;
        const hooks = this.#hooks.get(target) ?? new Map();
        const hook = hooks?.get(functionName) ?? new Hook(target, functionName);
        hook.addClient(client, callback, isBefore);
        hooks.set(functionName, hook);
        this.#hooks.set(target, hooks);
    }

    /**
     * @param {*} client
     */
    removeAll(client) {
        if (!this.#hooks?.size) return;
        for (const [target, hooks] of this.#hooks) {
            for (const [functionName, hook] of hooks) {
                hook.removeClient(client);
                if (!hook.isValid) hooks.delete(functionName);
            }
            if (!hooks.size) this.#hooks.delete(target);
        }
    }

    /**
     * @param {*} target
     * @param {Function} method
     * @returns {string?}
     */
    #getFunctionName(target, method) {
        for (const key in target) {
            if (target[key] !== method) continue;
            return key;
        }
        return null;
    }

}
