/* exported Main */

const Extension = imports.ui.extensionSystem.rocketbar;

const { Context } = Extension.imports.core.context;
const { Component } = Extension.imports.ui.base.component;

var Main = class {

    /** @type {Context} */
    #context = new Context();

    /** @type {Object} */
    #modules = {};

    constructor() {
        this.#update();
    }

    destroy() {
        for (const module in this.#modules) this.#modules[module]?.destroy();
        this.#context?.destroy();
    }

    #update() {
        // TODO
    }

    /**
     * @param {Object} module
     * @returns {Object|null} new module instance or null
     */
    #constructModule(module) {
        try {
            return new module();
        } catch (e) {
            logError(e, `${Extension.metadata.name}: Unable to construct module ${module}`);
        }
        return null;
    }

}
