//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Connections } = Me.imports.utils.connections;
const { Taskbar } = Me.imports.ui.taskbar;
const { ShellTweaks } = Me.imports.shell.tweaks;

//#endregion imports

//#region variables
let connections = null;
let settings = null;
let taskbar = null;
let shellTweaks = null;

//#endregion variables

//#region main

function init() {
    //TODO: ExtensionUtils.initTranslations();
}

function enable() {
    settings = ExtensionUtils.getSettings();

    shellTweaks = new ShellTweaks(settings);

    this._handleSettings();

    connections = new Connections();
    connections.add(settings, 'changed::taskbar-enabled', () => this._handleSettings());    
}

function disable() {

    // destroy all
    connections.destroy();
    taskbar?.destroy();
    shellTweaks?.destroy();
    settings?.run_dispose();

    // and nullify all
    taskbar = null;
    shellTweaks = null;
    settings = null;
    connections = null;
}

function _handleSettings() {

    if (settings.get_boolean('taskbar-enabled') && !taskbar) {
        taskbar = new Taskbar(settings);
    } else if (!settings.get_boolean('taskbar-enabled') && taskbar) {
        taskbar.destroy();
        taskbar = null;
    }

}

//#endregion main