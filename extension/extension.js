const ExtensionUtils = imports.misc.extensionUtils;

let instance = null;

var init = () => ExtensionUtils.initTranslations(),
    enable = () => {
        const extensionSystem = imports.ui.extensionSystem;
        extensionSystem.rocketbar = ExtensionUtils.getCurrentExtension();
        const { Main } = extensionSystem.rocketbar.imports.core.main;
        instance = new Main();
    },
    disable = () => {
        instance?.destroy();
        instance = null;
        delete imports.ui.extensionSystem.rocketbar;
    };
