//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Taskbar } = Me.imports.ui.taskbar;

//#endregion imports

//#region variables

let settings = null;
let taskbar = null;

//#endregion variables

//#region main

function enable() {
    settings = ExtensionUtils.getSettings();
    taskbar = new Taskbar(settings);
}

function disable() {
    // destroy
    taskbar?.destroy();
    settings?.run_dispose();
    // nullify
    taskbar = null;
    settings = null;
}

function init() {
    // TODO: init translations?
}

//#endregion main