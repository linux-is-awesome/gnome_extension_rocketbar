/* exported Main */

const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();

const { Connections } = Extension.imports.utils.connections;
const { IconProvider } = Extension.imports.utils.iconProvider;
const { LauncherAPI } = Extension.imports.utils.launcherAPI;

var Main = class {

    /** @type {Object} */
    #modules = {};

    /** @type {Gio.Settings} */
    #settings = ExtensionUtils.getSettings();

    /** @type {Connections} */
    #connections = new Connections();

    constructor() {
        // call instance() to initialize dbus interface
        // this should be done as soon as possible
        // to make apps use the interface correctly
        LauncherAPI.instance();

        this.#update();

        // this.#connections.addScope(this._settings, [
        //     'changed::taskbar-enabled',
        //     'changed::notification-counter-enabled'
        // ], () => this.#update());  
    }

    destroy() {
        this.#connections.destroy();
        for (const module in this.#modules) this.#modules[module]?.destroy();
        this.#settings.run_dispose();
        IconProvider.destroy();
        LauncherAPI.destroy();
    }

    #update() {

        // if (!this._modules.shellTweaks) {
        //     this._modules.shellTweaks = this._createModule(ShellTweaks);
        // }

        // const taskbarEnabled = this._settings.get_boolean('taskbar-enabled');
        // const notificationCounterEnabled = this._settings.get_boolean('notification-counter-enabled');

        // if (taskbarEnabled && !this._modules.taskbar) {
        //     this._modules.taskbar = this._createModule(Taskbar);
        // } else if (!taskbarEnabled && this._modules.taskbar) {
        //     this._modules.taskbar.destroy();
        //     this._modules.taskbar = null;
        // }

        // if (notificationCounterEnabled && !this._modules.notificationCounter) {
        //     this._modules.notificationCounter = this._createModule(NotificationCounter);
        // } else if (!notificationCounterEnabled && this._modules.notificationCounter) {
        //     this._modules.notificationCounter.destroy();
        //     this._modules.notificationCounter = null;
        // }
    }

    /**
     * @param {Object} module
     * @returns {Object} module instance
     */
    #constructModule(module) {
        try {
            return new module(this.#settings);
        } catch (e) {
            logError(e, `${Extension.metadata.name}: Unable to construct module ${module}`);
        }
        return null;
    }
}
