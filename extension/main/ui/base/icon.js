import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Context from '../../core/context.js';
import { Component } from './component.js';
import { Delay, Event } from '../../../shared/core/enums.js';

const ASSETS_ICONS_PATH = `${Context.path}/assets/icons/`;
const ASSETS_ICON_FILE_TYPE = '.svg';
const ICON_PATH_REGEXP_STRING = /^\/(.)*(\.(svg|png))$/;
const ICON_PATH_SEPARATOR = '/';

/** @type {{[prop: string]: *}} */
const DefaultProps = {
    visible: false,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER
};

/** @enum {string} */
export const IconEvent = {
    TextureChanged: 'icon::texture-changed'
};

/**
 * @augments Component<St.Icon>
 */
export class Icon extends Component {

    /**
     * @param {string?} path
     * @returns {boolean}
     */
    static isIconFilePath(path) {
        if (typeof path !== 'string') return false;
        path = path.trim();
        if (!path) return false;
        return ICON_PATH_REGEXP_STRING.test(path);
    }

    /** @type {string?} */
    #iconPath = null;

    /** @type {Gio.Icon?} */
    #iconTexture = null;

    /** @param {string?} value */
    set iconPath(value) {
        value = value || null;
        if (this.#iconPath === value) return;
        if (typeof value !== 'string' && value !== null) return;
        this.#iconPath = value;
        this.#rerender();
    }

    /** @param {Gio.Icon?} value */
    set iconTexture(value) {
        if (this.#iconTexture === value) return;
        if (value instanceof Gio.Icon === false && value !== null) return;
        this.#iconTexture = value;
        this.#iconPath = null;
        this.#rerender();
    }

    /**
     * @param {string|Gio.Icon|{iconTexture?: Gio.Icon?, iconPath?: string?}|null} [icon]
     * @param {string?} [name]
     */
    constructor(icon, name = null) {
        super(new St.Icon({ name, ...DefaultProps }));
        this.connect(Event.Destroy, () => this.#destroy());
        if (!icon) return;
        if (icon instanceof Gio.Icon) {
            this.#iconTexture = icon;
        } else if (typeof icon === 'string') {
            this.#iconPath = icon;
        } else if (icon.iconTexture instanceof Gio.Icon) {
            this.#iconTexture = icon.iconTexture;
        } else if (typeof icon.iconPath === 'string') {
            this.#iconPath = icon.iconPath;
        } else return;
        this.#rerender();
    }

    #destroy() {
        const actor = this.actor;
        Context.jobs.removeAll(actor);
        Context.signals.removeAll(actor);
        this.#iconPath = null;
        this.#iconTexture = null;
    }

    #rerender() {
        const actor = this.actor;
        const iconPath = this.#iconPath;
        const hasIconPath = !!iconPath;
        let isThemeControlled = hasIconPath && Context.desktop.iconTheme.has_icon(iconPath);
        let isVisible = isThemeControlled;
        if (isThemeControlled) {
            const oldName = actor.get_icon_name();
            if (oldName === iconPath) actor.set_icon_name(null);
            actor.set_icon_name(iconPath);
        } else {
            const isFilePath = hasIconPath && iconPath.startsWith(ICON_PATH_SEPARATOR);
            const iconFilePath = isFilePath && Icon.isIconFilePath(iconPath) ? iconPath : null;
            const assetsIconPath = hasIconPath && !isFilePath && !iconFilePath ?
                                   `${ASSETS_ICONS_PATH}${iconPath}${ASSETS_ICON_FILE_TYPE}` : null;
            const iconTexture = iconFilePath ? Gio.Icon.new_for_string(iconFilePath) :
                                assetsIconPath ? Gio.Icon.new_for_string(assetsIconPath) :
                                this.#iconTexture;
            const oldTexture = actor.get_gicon();
            if (oldTexture) actor.set_gicon(null);
            if (iconTexture) {
                actor.set_gicon(iconTexture);
                isThemeControlled = !iconFilePath;
                isVisible = true;
            }
        }
        actor.visible = isVisible;
        this.notifySelf(IconEvent.TextureChanged);
        if (!isThemeControlled) Context.signals.removeAll(actor);
        if (!isThemeControlled || Context.signals.hasClient(actor)) return;
        Context.signals.add(actor, [Context.desktop.settings, Event.IconThemeChanged, () =>
            Context.jobs.removeAll(actor).new(actor, Delay.Background).destroy(() => this.#rerender())]);
    }

}
