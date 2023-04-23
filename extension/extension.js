/* exported init */

class Extension {

    /**
     * @typedef {import('./core/context.js').Context} Context
     * @type {Context}
     */
    #instance = null;

    constructor() {
        const extensionUtils = imports.misc.extensionUtils;
        extensionUtils.initTranslations();
    }

    /**
     * Note: setTimeout is a temporary workaround for Gnome 44.
     *       Without it session won't start for some reason.
     */
    enable() {
        const extensionInfo = this.#getExtensionInfo();
        setTimeout(() => import('./core/context.js').then(({ Context }) => {
            this.#instance = new Context(extensionInfo);
        }).catch(e => console.error(`${extensionInfo.metadata.name} initialization failed.`, e)));
    }

    disable() {
        this.#instance?.destroy();
        this.#instance = null;
    }

    #getExtensionInfo() {
        const extensionUtils = imports.misc.extensionUtils;
        const extension = extensionUtils.getCurrentExtension();
        const settings = extensionUtils.getSettings();
        return { ...extension, ...{ settings } };
    }

}

var init = () => new Extension();