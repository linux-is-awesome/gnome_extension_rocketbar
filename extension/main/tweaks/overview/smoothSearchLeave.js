import { SIDE_CONTROLS_ANIMATION_TIME } from 'resource:///org/gnome/shell/ui/overviewControls.js';
import { Overview } from '../../core/shell.js';
import Context from '../../core/context.js';

export default class {

    /** @type {boolean} */
    #isPendingHide = false;

    /** @type {boolean} */
    #isHideAllowed = false;

    constructor() {
        Context.hooks.add(this, Overview, Overview.hide, () => this.#handleOverviewHide(), true);
    }

    destroy() {
        Context.jobs.removeAll(this);
        Context.hooks.removeAll(this);
        this.#isPendingHide = false;
        this.#isHideAllowed = false;
    }

    /**
     * @returns {boolean|undefined}
     */
    #handleOverviewHide() {
        if (this.#isHideAllowed) return;
        if (this.#isPendingHide) return true;
        const searchController = Overview.searchController;
        if (!searchController?.searchActive ||
            typeof searchController.reset !== 'function') return;
        this.#isPendingHide = true;
        searchController.reset();
        Context.jobs.replace(this, SIDE_CONTROLS_ANIMATION_TIME).destroy(() => {
            this.#isPendingHide = false;
            if (!Overview.visible) return;
            this.#isHideAllowed = true;
            Overview.hide();
            this.#isHideAllowed = false;
        });
        return true;
    }

}
