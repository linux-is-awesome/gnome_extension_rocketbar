/* exported init */

class Extension {

    /**
     * @typedef {import('./core/context.js').Context} Context
     * @type {Context}
     */
    #instance = null;

    constructor() {
        imports.misc.extensionUtils.initTranslations();
    }

    /**
     * Note: setTimeout is a temporary workaround for Gnome 44.
     *       Without it session won't start for some reason.
     * 
     * TODO: remove setTimeout.
     */
    enable() {
        setTimeout(() => import('./core/context.js').then(({ Context }) => {
            this.#instance = new Context();
        }).catch(e => {
            const extension = imports.misc.extensionUtils.getCurrentExtension();
            console.error(`${extension.metadata.name} initialization failed.`, e);
        }));
    }

    disable() {
        this.#instance?.destroy();
        this.#instance = null;
    }

}

var init = () => new Extension();