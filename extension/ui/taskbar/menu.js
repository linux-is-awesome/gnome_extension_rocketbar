/* exported Menu */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { AppMenu } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { ComponentLocation } from '../base/component.js';
import { Config } from '../../utils/config.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const DEFAULT_STYLE_CLASS = 'panel-menu aggregate-menu rocketbar__popup-menu';

/** @type {Object.<string, boolean>} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindows: true
};

/** @enum {string} */
const ConfigFields = {
    isolateWorkspaces: 'taskbar-isolate-workspaces',
    showFavorites: 'taskbar-show-favorites'
};

/** @type {Object.<number, number>} */
const MenuPosition = {
    [ComponentLocation.Top]: St.Side.TOP,
    [ComponentLocation.Bottom]: St.Side.BOTTOM
};

export class Menu extends AppMenu {

    /**
     * @typedef {import('./appButton.js').AppButton} AppButton
     * @type {AppButton}
     */
    #appButton = null;

    /** @type {boolean} */
    #hasValidApp = true;

    /** @type {Object.<string, boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton.actor, St.Side.TOP, DefaultProps);
        this.#appButton = appButton;
        this.actor.remove_style_class_name(UNWANTED_STYLE_CLASS);
        this.actor.add_style_class_name(DEFAULT_STYLE_CLASS);
        this.setApp(appButton.app);
        this.#hasValidApp = this._appSystem?.lookup_app(this._app?.id) ? true : false;
        // TODO
        this.moveMenuItem(this._quitItem, this.numMenuItems);
        this._updateDetailsVisibility();
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions.
     *       
     */
    destroy() {
        Context.signals.removeAll(this);
        this.close(false);
        this._app?.disconnectObject(this);
        this._app = null;
        super.destroy();
    }

    /**
     * @param {BoxPointer.PopupAnimation} animation
     */
    open(animation) {
        this.actor._arrowSide = MenuPosition[this.#appButton.location];
        super.open(animation);
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigFields.isolateWorkspaces:
                this._updateWindowsSection();
                break;
            case ConfigFields.showFavorites:
                this._updateFavoriteItem();
                break;
            default: return;
        }
    }

    /**
     * @param {*} actor
     * @param {Clutter.Event} event
     * @returns {number}
     */
    _onKeyPress(actor, event) {
        const key = event?.get_key_symbol();
        if (key === Clutter.KEY_space ||
            key === Clutter.KEY_Return) return Clutter.EVENT_PROPAGATE;
        return super._onKeyPress(actor, event);
    }

    _updateFavoriteItem() {
        super._updateFavoriteItem();
        if (!this._toggleFavoriteItem?.visible) return;
        if (!this.#config.showFavorites) return this._toggleFavoriteItem.hide();
        const isFavorite = this._appFavorites?.isFavorite(this._app?.id);
        if (isFavorite) return;
        this._toggleFavoriteItem.label?.set_text('Pin');
    }

    _updateWindowsSection() {
        if (!this._app) return;
        if (!this.#config.isolateWorkspaces) return super._updateWindowsSection();
        const origin = this._app;
        const workspace = global.workspace_manager.get_active_workspace();
        this._app = {
            get_windows: () => origin.get_windows().filter(window => window.get_workspace() === workspace),
            get_name: () => origin.get_name()
        };
        super._updateWindowsSection();
        this._app = origin;
    }

    _updateDetailsVisibility() {
        if (this._app && this.#hasValidApp) super._updateDetailsVisibility();
        else this._detailsItem.hide();
    }

}
