//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Connections } = Me.imports.utils.connections;
const { ShellTweaks } = Me.imports.main.tweaks;
const { Taskbar } = Me.imports.ui.taskbar;
const { NotificationCounter } = Me.imports.ui.notificationCounter;
const { IconProvider } = Me.imports.utils.iconProvider;
const { LauncherAPI } = Me.imports.utils.launcherAPI;

//#endregion imports

var Modules = class {

    constructor() {
        this._modules = {};
        this._settings = ExtensionUtils.getSettings();

        // call instance() to initialize dbus interface
        // this should be done as soon as possible
        // to make apps use the interface correctly
        LauncherAPI.instance();

        this._updateModules();

        // create connections
        this._connections = new Connections();
        this._connections.addScope(this._settings, [
            'changed::taskbar-enabled',
            'changed::notification-counter-enabled'
        ], () => this._updateModules());  
    }

    destroy() {
        this._connections.destroy();

        for (let module in this._modules) {
            this._modules[module]?.destroy();
        }

        this._settings.run_dispose();

        IconProvider.destroy();
        LauncherAPI.destroy();

        this._modules = null;
    }

    _updateModules() {

        if (!this._modules.shellTweaks) {
            this._modules.shellTweaks = this._createModule(ShellTweaks);
        }

        const taskbarEnabled = this._settings.get_boolean('taskbar-enabled');
        const notificationCounterEnabled = this._settings.get_boolean('notification-counter-enabled');

        if (taskbarEnabled && !this._modules.taskbar) {
            this._modules.taskbar = this._createModule(Taskbar);
        } else if (!taskbarEnabled && this._modules.taskbar) {
            this._modules.taskbar.destroy();
            this._modules.taskbar = null;
        }

        if (notificationCounterEnabled && !this._modules.notificationCounter) {
            this._modules.notificationCounter = this._createModule(NotificationCounter);
        } else if (!notificationCounterEnabled && this._modules.notificationCounter) {
            this._modules.notificationCounter.destroy();
            this._modules.notificationCounter = null;
        }
    }

    _createModule(module) {
        try {
            return new module(this._settings);
        } catch (e) {
            logError(e, Me.metadata.name + ' Error');
        }
        return null;
    }
}
