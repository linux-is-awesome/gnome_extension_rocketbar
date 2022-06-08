//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Taskbar } = Me.imports.taskbar;

//#endregion imports

//#region variables

let settings = null;

let taskbar = null;
let taskbarCache = null;

//#endregion variables

//#region main

function enable() {
    settings = ExtensionUtils.getSettings();
    taskbar = new Taskbar(settings, taskbarCache);
}

function disable() {

    // save some of the taskbar's cached data in memory
    // to restore it after unlocking user's session  
    taskbarCache = taskbar?.getSessionCache();
    taskbar?.destroy();
    taskbar = null;

    settings?.run_dispose();
    settings = null;
}

function init() {
    // TODO: init translations?
}

//#endregion main