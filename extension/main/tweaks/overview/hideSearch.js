/**
 * @typedef {import('resource:///org/gnome/shell/ui/searchController.js').SearchController} SearchController
 * @typedef {import('resource:///org/gnome/shell/ui/workspaceThumbnail.js').ThumbnailsBox} ThumbnailsBox
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { ThumbnailsBox, MAX_THUMBNAIL_SCALE } from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import { Overview, CtrlAltTabManager } from '../../core/shell.js';
import Context from '../../core/context.js';
import { Event } from '../../../shared/enums/general.js';
import { Animation, AnimationDuration, AnimationType } from '../../ui/base/animation.js';

const WORKSPACE_THUMBNAIL_SCALE = 0.1;

export default class {

    /** @type {Clutter.Actor?} */
    #searchContainer = Overview.searchEntry?.get_parent() ?? null;

    /** @type {SearchController?} */
    #searchController = Overview.searchController ?? null;

    /** @type {ThumbnailsBox?} */
    #workspaceThumbnails = Overview._overview?.controls?._thumbnailsBox ?? null;

    /** @type {{[field: string]: *}?} */
    #ctrlAltTabItem = null;

    constructor() {
        if (!this.#searchController || !this.#searchContainer || !this.#workspaceThumbnails) return;
        Context.signals.add(this,
            [this.#searchController, Event.SearchActive, () => this.#toggleSearch()]);
        this.#toggleSearch();
        this.#setWorkspaceThumbnailsScale(this.#workspaceThumbnails, WORKSPACE_THUMBNAIL_SCALE);
        const prototype = ThumbnailsBox.prototype;
        Context.hooks.add(this, prototype, prototype._init,
            target => this.#setWorkspaceThumbnailsScale(target, WORKSPACE_THUMBNAIL_SCALE), true);
    }

    destroy() {
        if (!this.#searchContainer || !this.#searchController || !this.#workspaceThumbnails) return;
        Context.signals.removeAll(this);
        Context.hooks.removeAll(this);
        this.#restoreCtrlAltTabItem();
        this.#setWorkspaceThumbnailsScale(this.#workspaceThumbnails, MAX_THUMBNAIL_SCALE);
        this.#searchContainer.set({ ...AnimationType.OpacityMax, height: -1 });
        this.#searchContainer = null;
        this.#searchController = null;
        this.#workspaceThumbnails = null;
    }

    #toggleSearch() {
        if (!this.#searchController || !this.#searchContainer) return;
        const searchContainerOpacity = this.#searchContainer.opacity;
        const isSearchActive = !!this.#searchController.searchActive;
        const isSearchShown = searchContainerOpacity === AnimationType.OpacityMax.opacity;
        if (isSearchActive && isSearchShown) return;
        if (isSearchActive) this.#showSearch();
        else this.#hideSearch();
    }

    async #showSearch() {
        if (this.#searchContainer instanceof St.Widget === false) return;
        this.#restoreCtrlAltTabItem();
        const searchContainer = this.#searchContainer;
        searchContainer.set_height(-1);
        const height = searchContainer.get_height();
        searchContainer.set_height(0);
        const mode = Clutter.AnimationMode.EASE_OUT_QUAD;
        const duration = AnimationDuration.Fast;
        const isHeightRestored = await Animation(searchContainer, duration, { height, mode });
        if (!isHeightRestored) return;
        searchContainer.set_height(-1);
        Animation(searchContainer, duration, { ...AnimationType.OpacityMax, mode });
    }

    #hideSearch() {
        if (this.#searchContainer instanceof St.Widget === false) return;
        this.#hideCtrlAltTabItem();
        this.#searchContainer.remove_all_transitions();
        this.#searchContainer.set({ ...AnimationType.OpacityMin, height: 0 });
        if (!this.#workspaceThumbnails?.visible) return;
        this.#workspaceThumbnails.expandFraction = 1.0;
    }

    /**
     * @param {ThumbnailsBox} target
     * @param {number} scale
     */
    #setWorkspaceThumbnailsScale(target, scale) {
        if (!target) return;
        target._maxThumbnailScale = scale;
    }

    #hideCtrlAltTabItem() {
        const searchEntry = this.#searchController?._entry;
        if (!searchEntry || !CtrlAltTabManager._items?.length) return;
        this.#ctrlAltTabItem = CtrlAltTabManager._items.find(item => item.root === searchEntry) ?? null;
        if (!this.#ctrlAltTabItem) return;
        const ctrlAltTabItems = new Set(CtrlAltTabManager._items);
        ctrlAltTabItems.delete(this.#ctrlAltTabItem);
        CtrlAltTabManager._items = [...ctrlAltTabItems];
    }

    #restoreCtrlAltTabItem() {
        if (!this.#ctrlAltTabItem) return;
        CtrlAltTabManager._items?.push(this.#ctrlAltTabItem);
        this.#ctrlAltTabItem = null;
    }

}
