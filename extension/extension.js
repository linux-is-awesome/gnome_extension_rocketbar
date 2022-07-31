//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Connections } = Me.imports.utils.connections;
const { ShellTweaks } = Me.imports.shell.tweaks;
const { Taskbar } = Me.imports.ui.taskbar;
const { NotificationCounter } = Me.imports.ui.notificationCounter;
const { IconProvider } = Me.imports.utils.iconProvider;

//#endregion imports

//#region variables

let connections = null;
let settings = null;
let shellTweaks = null;
let taskbar = null;
let notificationCounter = null;

//#endregion variables

//#region main

function init() {
    ExtensionUtils.initTranslations();
}

function enable() {

    settings = ExtensionUtils.getSettings();

    shellTweaks = this._createModule(ShellTweaks);

    this._handleSettings();

    connections = new Connections();
    connections.addScope(settings, [
        'changed::taskbar-enabled',
        'changed::notification-counter-enabled'
    ], () => this._handleSettings());    
}

function disable() {

    // destroy all
    connections.destroy();
    taskbar?.destroy();
    notificationCounter?.destroy();
    shellTweaks?.destroy();
    settings?.run_dispose();
    IconProvider.destroy();

    // and nullify all
    taskbar = null;
    notificationCounter = null;
    shellTweaks = null;
    settings = null;
    connections = null;

}

function _handleSettings() {

    const taskbarEnabled = settings.get_boolean('taskbar-enabled');
    const notificationCounterEnabled = settings.get_boolean('notification-counter-enabled');

    if (taskbarEnabled && !taskbar) {
        taskbar = this._createModule(Taskbar);
    } else if (!taskbarEnabled && taskbar) {
        taskbar.destroy();
        taskbar = null;
    }

    if (notificationCounterEnabled && !notificationCounter) {
        notificationCounter = this._createModule(NotificationCounter);
    } else if (!notificationCounterEnabled && notificationCounter) {
        notificationCounter.destroy();
        notificationCounter = null;
    }

}

function _createModule(module) {
    try {
        return new module(settings);
    } catch (e) {
        logError(e, Me.metadata.name + ' Error');
    }
    return null;
}

//#endregion main