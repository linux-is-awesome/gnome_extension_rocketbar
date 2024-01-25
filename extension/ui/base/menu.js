/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/slider.js').Slider} Slider
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSubMenu} PopupSubMenu
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSubMenuMenuItem} PopupSubMenuMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSeparatorMenuItem} PopupSeparatorMenuItem
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Slider } from 'resource:///org/gnome/shell/ui/slider.js';
import { arrowIcon as ArrowIcon,
         Ornament,
         PopupMenu,
         PopupSubMenuMenuItem,
         PopupSeparatorMenuItem,
         PopupBaseMenuItem,
         PopupMenuSection } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Event, PseudoClass } from '../../core/enums.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const SLIDER_ICON_STYLE_CLASS = 'popup-menu-icon';
const THEME_NODE_ARROW_RISE = '-arrow-rise';
const CHANGE_INDICATOR = ' *';

/** @type {{[prop: string]: *}} */
const SliderMenuItemProps = {
    activate: false
};

/** @type {{[prop: string]: *}} */
const SliderIconProps = {
    style_class: SLIDER_ICON_STYLE_CLASS,
    visible: false
};

/** @type {{[prop: string]: *}} */
const SliderValueProps = {
    visible: false,
    y_expand: true,
    y_align: Clutter.ActorAlign.CENTER
};

/** @type {{[prop: string]: *}} */
const MenuItemExpanderProps = {
    x_expand: true
};

export class SliderMenuItem {

    /** @type {PopupBaseMenuItem} */
    #actor = new PopupBaseMenuItem(SliderMenuItemProps);

    /** @type {Slider} */
    #slider = new Slider(0);

    /** @type {St.Icon} */
    #icon = new St.Icon(SliderIconProps);

    /** @type {St.Label} */
    #value = new St.Label(SliderValueProps);

    /** @type {PopupBaseMenuItem} */
    get actor() {
        return this.#actor;
    }

    /** @type {Slider} */
    get slider() {
        return this.#slider;
    }

    /** @param {string?} value */
    set icon(value) {
        const iconName = typeof value === 'string' ? value : null;
        this.#icon.set_icon_name(iconName);
        this.#icon.visible = !!iconName;
    }

    /** @param {number?} value */
    set value(value) {
        const text = typeof value === 'number' ? Math.round(value).toString() : null;
        this.#value.set_text(text);
        this.#value.visible = !!text;
    }

    /**
     * @param {(menuItem: SliderMenuItem) => void} callback
     * @param {string?} [icon]
     * @param {number?} [value]
     */
    constructor(callback, icon, value) {
        this.#actor.setOrnament(Ornament.HIDDEN);
        this.#actor.add_child(this.#icon);
        this.#actor.add_child(this.#slider);
        this.#actor.add_child(this.#value);
        this.icon = icon ?? null;
        this.value = value ?? null;
        this.#actor.connect(Event.KeyPress, (_, event) => this.#slider.emit(Event.KeyPress, event));
        if (typeof callback !== 'function') return;
        this.#slider.connect(Event.ValueChanged, () => callback(this));
    }

}

export class CollapsibleGroup {

    /** @type {PopupSubMenuMenuItem?} */
    #actor = null;

    /** @type {PopupSubMenuMenuItem} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#actor;
    }

    /** @type {PopupSubMenu} */
    get menu() {
        const menu = this.#actor?.menu;
        if (!menu) throw new Error(`${this.constructor.name} is invalid.`);
        return menu;
    }

    /** @type {boolean} */
    get isOpen() {
        return this.#actor?.menu?.isOpen ?? false;
    }

    /** @param {string} value */
    set title(value) {
        if (!this.#actor?.label) return;
        this.#actor.label.text = value;
    }

    /** @param {boolean} value */
    set visible(value) {
        if (!this.#actor || typeof value !== 'boolean') return;
        this.#actor.visible = value;
    }

    /**
     * @param {string?} [title]
     */
    constructor(title) {
        this.#actor = new PopupSubMenuMenuItem(title);
        this.#actor.connect(Event.Destroy, () => (this.#actor = null));
    }

}

export class ChildMenu extends PopupMenuSection {

    /** @type {Set<Clutter.Actor>?} */
    #hiddenMenuItems = new Set();

    /** @type {PopupBaseMenuItem?} */
    #titleMenuItem = null;

    /** @type {St.Icon?} */
    #arrowLeft = null;

    /** @type {St.Icon?} */
    #arrowRight = null;

    /** @type {PopupMenuSection?} */
    #menu = null;

    /** @type {PopupMenuSection} */
    get menu() {
        if (!this.#menu) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#menu;
    }

    /** @type {PopupMenu?} */
    get parentMenu() {
        const result = this._getTopMenu();
        return result instanceof PopupMenu ? result : null;
    }

    /**
     * @param {string} title
     */
    constructor(title) {
        super();
        this.isOpen = false;
        this.#menu = new PopupMenuSection();
        this.#arrowLeft = ArrowIcon(St.Side.LEFT);
        this.#arrowRight = ArrowIcon(St.Side.RIGHT);
        this.#menu.actor.hide();
        this.#arrowLeft.hide();
        this.#titleMenuItem = this.addAction(title, () => this.toggle());
        this.#titleMenuItem.add_child(new St.Bin(MenuItemExpanderProps));
        this.#titleMenuItem.insert_child_at_index(this.#arrowLeft, 0);
        this.#titleMenuItem.add_child(this.#arrowRight);
        this.addMenuItem(this.#menu);
        this.connect(Event.MenuClosed, () => this.#hide());
    }

    /**
     * @override
     */
    destroy() {
        super.destroy();
        this.#menu = null;
        this.#titleMenuItem = null;
        this.#hiddenMenuItems?.clear();
        this.#hiddenMenuItems = null;
        this.#arrowLeft = null;
        this.#arrowRight = null;
    }

    /**
     * Note: Prevent undesirable behavior when the parent menu calls this function.
     *
     * @override
     */
    itemActivated() {}

    /**
     * Note: Prevent undesirable behavior when the parent menu calls this function.
     *
     * @override
     */
    open() {}

    /**
     * Note: Set closed flag if parent menu is closed but don't handle state.
     *
     * @override
     */
    close() {
        this.isOpen = false;
        super.close();
    }

    /**
     * @override
     */
    toggle() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) super.open();
        this.#handleState();
        if (this.isOpen) return;
        super.close();
    }

    /**
     * @param {PopupBaseMenuItem?} menuItem
     * @param {boolean} [isActive]
     * @returns {void}
     */
    setItemActiveState(menuItem, isActive = true) {
        if (menuItem instanceof PopupBaseMenuItem === false) return;
        menuItem.reactive = isActive;
        menuItem.can_focus = isActive;
        if (isActive) return menuItem.remove_style_pseudo_class(PseudoClass.Insensitive);
        menuItem.add_style_pseudo_class(PseudoClass.Insensitive);
        menuItem.remove_style_pseudo_class(PseudoClass.Focus);
    }

    /**
     * @param {string} title
     * @param {{[value: string]: string}} items
     * @param {(value: string, items: {[value: string]: string}) => void} callback
     * @param {boolean} [isCollapsible]
     * @returns {(value: string, isDefaultValue: boolean) => (PopupBaseMenuItem|CollapsibleGroup)[]}
     */
    addRadioGroup(title, items, callback, isCollapsible = false) {
        /** @type {Map<string, PopupBaseMenuItem?>} */
        const group = new Map();
        const separator = this.addSeparator(title);
        const collapsible = isCollapsible ? this.addCollapsibleGroup() : null;
        const menu = collapsible?.menu ?? this.#menu;
        if (collapsible?.menu) {
            collapsible.menu.itemActivated = () => collapsible.menu?.close(true);
        }
        /**
         * @param {string} value
         * @param {boolean} isDefaultValue
         * @returns {(PopupBaseMenuItem|CollapsibleGroup)[]}
         */
        const handler = (value, isDefaultValue = true) => {
            /** @type {(PopupBaseMenuItem|CollapsibleGroup)[]} */
            const result = [separator];
            this.setChangedIndicator(separator, !isDefaultValue);
            if (collapsible) {
                collapsible.title = items[value] ?? null;
                result.push(collapsible);
            }
            for (const [itemValue, item] of group) {
                if (!item) continue;
                if (itemValue === value) item.setOrnament(Ornament.DOT);
                else item.setOrnament(Ornament.NONE);
                if (!collapsible) result.push(item);
            }
            if (typeof callback === 'function') callback(value, items);
            return result;
        };
        for (const value in items) {
            group.set(value, menu?.addAction(items[value], () => handler(value, false)) ?? null);
        }
        return handler;
    }

    /**
     * @param {string?} [title]
     * @returns {PopupSeparatorMenuItem}
     */
    addSeparator(title = null) {
        const result = new PopupSeparatorMenuItem(title);
        this.#menu?.addMenuItem(result);
        return result;
    }

    /**
     * @param {string?} [title]
     * @returns {CollapsibleGroup}
     */
    addCollapsibleGroup(title = null) {
        const result = new CollapsibleGroup(title);
        this.#menu?.addMenuItem(result.actor);
        return result;
    }

    /**
     * @param {PopupBaseMenuItem} menuItem
     * @param {boolean} [isChanged]
     */
    setChangedIndicator(menuItem, isChanged = true) {
        if (menuItem instanceof PopupSeparatorMenuItem === false ||
            !menuItem.label?.text) return;
        if (isChanged && menuItem.label.text.includes(CHANGE_INDICATOR)) return;
        menuItem.label.text = isChanged ? `${menuItem.label.text}${CHANGE_INDICATOR}` :
                              menuItem.label.text.replace(CHANGE_INDICATOR, '');
    }

    #handleState() {
        const parentMenu = this.parentMenu;
        if (!parentMenu) return;
        const parentActor = parentMenu.actor;
        if (!parentMenu.isOpen || !parentActor) return;
        parentActor.remove_all_transitions();
        const location = parentActor._arrowSide;
        const translation = parentMenu._boxPointer?.get_theme_node()?.get_length(THEME_NODE_ARROW_RISE) ?? 0;
        const mode = Clutter.AnimationMode.LINEAR;
        Animation(parentActor, AnimationDuration.Fast, { ...AnimationType.OpacityMin, mode }).then(() => {
            parentMenu._openedSubMenu?.close();
            if (this.isOpen) this.#show();
            else this.#hide();
            this.#titleMenuItem?.grab_key_focus();
            parentActor.translation_y = location === St.Side.BOTTOM ? translation : -translation;
            Animation(parentActor, AnimationDuration.Fast, { ...AnimationType.OpacityMax, ...AnimationType.TranslationReset, mode });
        });
    }

    #show() {
        if (!this.#hiddenMenuItems) return;
        this.#menu?.actor.show();
        this.#arrowLeft?.show();
        this.#arrowRight?.hide();
        const menuItems = this.actor?.get_parent()?.get_children();
        if (!menuItems) return;
        for (let i = 0, l = menuItems.length; i < l; ++i) {
            const menuItem = menuItems[i];
            if (menuItem === this.actor) continue;
            if (menuItem instanceof St.ScrollView || !menuItem.visible) continue;
            this.#hiddenMenuItems.add(menuItem);
            menuItem.hide();
        }
    }

    #hide() {
        this.#menu?.actor.hide();
        this.#arrowLeft?.hide();
        this.#arrowRight?.show();
        if (!this.#hiddenMenuItems?.size) return;
        for (const menuItem of this.#hiddenMenuItems) menuItem.show();
        return this.#hiddenMenuItems.clear();
    }

}