//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Taskbar } = Me.imports.ui.taskbar;
const { ShellTweaks } = Me.imports.shell.tweaks;

//#endregion imports

//#region variables

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
    taskbar = new Taskbar(settings);
    shellTweaks = new ShellTweaks(settings);
}

function disable() {
    // destroy all
    taskbar?.destroy();
    shellTweaks?.destroy();
    settings?.run_dispose();
    // and nullify all
    taskbar = null;
    shellTweaks = null;
    settings = null;
}

//#endregion main