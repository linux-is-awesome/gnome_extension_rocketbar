//#region imports

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Modules } = Me.imports.main.modules;

//#endregion imports

//#region variables

let modules = null;

//#endregion variables

//#region main

function init() {
    ExtensionUtils.initTranslations();
}

function enable() {
    modules = new Modules();
}

function disable() {
    modules?.destroy();
    modules = null;
}

//#endregion main
