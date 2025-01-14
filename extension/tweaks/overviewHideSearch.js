/**
 * @typedef {import('resource:///org/gnome/shell/ui/searchController.js').SearchController} SearchController
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { ThumbnailsBox, MAX_THUMBNAIL_SCALE } from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import { Overview } from '../main/shell.js';
import Context from '../main/context.js';
import { Event } from '../shared/enums.js';
import { Animation, AnimationDuration, AnimationType } from '../ui/base/animation.js';

const WORKSPACE_THUMBNAIL_SCALE = 0.1;

export default class {

    /** @type {Clutter.Actor?} */
    #searchContainer = Overview.searchEntry?.get_parent() ?? null;

    /** @type {SearchController?} */
    #searchController = Overview.searchController ?? null;

    /** @type {((...args) => void)?} */
    #backup = null;

    constructor() {
        if (!this.#searchController || !this.#searchContainer) return;
        Context.signals.add(this,
            [this.#searchController, Event.SearchActive, () => this.#toggleSearch()]);
        this.#toggleSearch();
        this.#overrideWorkspaceThumbnailsScale();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#restoreWorkspaceThumbnailsScale();
        this.#searchContainer?.set({ ...AnimationType.OpacityMax, height: -1 });
        this.#searchContainer = null;
        this.#searchController = null;
        this.#backup = null;
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
        this.#searchContainer.remove_all_transitions();
        this.#searchContainer.set({ ...AnimationType.OpacityMin, height: 0 });
    }

    #overrideWorkspaceThumbnailsScale() {
        const workspaceThumbnails = Overview._overview?._controls?._thumbnailsBox;
        if (!workspaceThumbnails) return;
        workspaceThumbnails._maxThumbnailScale = WORKSPACE_THUMBNAIL_SCALE;
        const initThumbnailsBoxFunction = ThumbnailsBox.prototype._init;
        ThumbnailsBox.prototype._init = function (...args) {
            this._maxThumbnailScale = WORKSPACE_THUMBNAIL_SCALE;
            initThumbnailsBoxFunction.call(this, ...args);
        };
        this.#backup = initThumbnailsBoxFunction;
    }

    #restoreWorkspaceThumbnailsScale() {
        if (typeof this.#backup !== 'function') return;
        ThumbnailsBox.prototype._init = this.#backup;
        const workspaceThumbnails = Overview._overview?._controls?._thumbnailsBox;
        if (!workspaceThumbnails) return;
        workspaceThumbnails._maxThumbnailScale = MAX_THUMBNAIL_SCALE;
    }

}
