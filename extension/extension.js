const ExtensionUtils = imports.misc.extensionUtils;

let instance = null;

var init = () => ExtensionUtils.initTranslations(),
    enable = () => {
        const { Main } = ExtensionUtils.getCurrentExtension().imports.core.main;
        instance = new Main();
    },
    disable = () => {
        instance?.destroy();
        instance = null;
    };
