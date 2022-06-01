//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Taskbar } = Me.imports.taskbar;

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
    
    if (taskbar) {
        taskbar.destroy();
        taskbar = null;
    }

    if (settings) {
        settings.run_dispose();
        settings = null;
    }

}

function init() {
    // TODO: init translations?
}

//#endregion main