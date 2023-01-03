/* exported Icons */

const Extension = imports.ui.extensionSystem.rocketbar;

const { Gio, St, Gtk } = imports.gi;
const { Type } = Extension.imports.core.enums;

const ASSETS_PATH = `${Extension.path}/assets/icons/`;

/** @enum {string} */
const IconTypes = {
    SVG: '.svg',
    PNG: '.png'
};

var Icons = class {

    /** @type {Gtk.IconTheme} */
    #iconTheme = new Gtk.IconTheme();

    destroy() {
        this.#iconTheme?.destroy();
    }

    /**
     * @param {String} name
     * @param {Number} size
     * @returns {Gio.Icon}
     */
    get(name, size) {
        const iconInfo = this.getInfo(name, size);
        if (iconInfo) return Gio.Icon.new_for_string(iconInfo.get_filename());
        return this.getCustom(`${ASSETS_PATH}${name}${IconTypes.SVG}`);
    }

    /**
     * @param {String} name
     * @param {Number} size
     * @returns {Gtk.IconInfo}
     */
    getInfo(name, size) {
        if (typeof name !== Type.String || typeof size !== Type.Number) return null;
        this.#iconTheme.set_custom_theme(St.Settings.get().gtkIconTheme);
        return this.#iconTheme.lookup_icon(name, size, 0);
    }

    /**
     * @param {String} path
     * @returns {Gio.Icon}
     */
    getCustom(path) {
        if (!this.#isIconPath(path)) return null;
        const iconFile = Gio.File.new_for_path(path);
        if (!iconFile.query_exists(null)) return null;
        return Gio.Icon.new_for_string(iconFile.get_path());
    }

    /**
     * @param {String} path
     * @returns {Boolean}
     */
    #isIconPath(path) {
        if (typeof path !== Type.String || !path.length) return false;
        if (!path.startsWith('/')) return false;
        return path.endsWith(IconTypes.SVG) || path.endsWith(IconTypes.PNG);
    }

}
