const ExtensionUtils = imports.misc.extensionUtils;

let modules = null;

var init = () => ExtensionUtils.initTranslations(),
    enable = () => {
        const { Modules } = ExtensionUtils.getCurrentExtension().imports.main.modules;
        modules = new Modules();
    },
    disable = () => {
        modules?.destroy();
        modules = null;
    };
