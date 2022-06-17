//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Taskbar } = Me.imports.ui.taskbar;
const { ShellTweaks } = Me.imports.shell.tweaks;

//#endregion imports

//#region main

class ExtensionInstance {

    constructor(destroyCallback) {
        this.destroyCallback = destroyCallback;
    }

    enable() {
        this.settings = ExtensionUtils.getSettings();
        this.taskbar = new Taskbar(this.settings);
        this.shellTweaks = new ShellTweaks(this.settings);
    }

    disable() {

        this.taskbar?.destroy();
        this.shellTweaks?.destroy();
        this.settings?.run_dispose();

        this.destroyCallback();
    }

}

function init() {

    let extensionInstance = new ExtensionInstance(() => {
        // nullify the instance
        // I'm not really sure it's necessary but let's do it no matter why
        extensionInstance = null;
    });

    return extensionInstance;
}

//#endregion main