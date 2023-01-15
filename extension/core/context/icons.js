/* exported Icons */

//const Extension = imports.ui.extensionSystem.rocketbar;

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import St from 'gi://St';
import { Context } from '../context.js';
import { Type } from '../enums.js';

/** @enum {string} */
const IconTypes = {
    SVG: '.svg',
    PNG: '.png'
};

export class Icons {

    /** @type {Gtk.IconTheme} */
    #iconTheme = new Gtk.IconTheme();

    /** @type {string} */
    #assetsPath = `${Context.path}/assets/icons/`;

    destroy() {
        this.#iconTheme = null;
        this.#assetsPath = null;
    }

    /**
     * @param {string} name
     * @param {number} size
     * @returns {Gio.Icon|null}
     */
    get(name, size) {
        const iconInfo = this.getInfo(name, size);
        if (iconInfo) return Gio.Icon.new_for_string(iconInfo.get_filename());
        if (typeof this.#assetsPath !== Type.String) return null;
        return this.getCustom(`${this.#assetsPath}${name}${IconTypes.SVG}`);
    }

    /**
     * @param {string} name
     * @param {number} size
     * @returns {Gtk.IconInfo|null}
     */
    getInfo(name, size) {
        if (typeof name !== Type.String || typeof size !== Type.Number) return null;
        this.#iconTheme?.set_custom_theme(St.Settings.get().gtkIconTheme);
        return this.#iconTheme?.lookup_icon(name, size, 0);
    }

    /**
     * @param {string} path
     * @returns {Gio.Icon|null}
     */
    getCustom(path) {
        if (!this.#isIconPath(path)) return null;
        const iconFile = Gio.File.new_for_path(path);
        if (!iconFile.query_exists(null)) return null;
        return Gio.Icon.new_for_string(iconFile.get_path());
    }

    /**
     * @param {string} path
     * @returns {boolean}
     */
    #isIconPath(path) {
        if (typeof path !== Type.String || !path.length) return false;
        if (!path.startsWith('/')) return false;
        return path.endsWith(IconTypes.SVG) || path.endsWith(IconTypes.PNG);
    }

}
