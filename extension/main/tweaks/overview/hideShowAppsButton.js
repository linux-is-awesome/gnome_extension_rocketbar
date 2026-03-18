import St from 'gi://St';
import { Overview } from '../../core/shell.js';

const BUTTON_CONTAINER_STYLE_CLASS = 'rocketbar__tweak_hide-show-apps-button';

export default class {

    constructor() {
        this.#changeVisibility(true);
    }

    destroy() {
        this.#changeVisibility(false);
    }

    /**
     * @param {boolean} isHidden
     */
    #changeVisibility(isHidden) {
        const showAppsButton = Overview.dash?.showAppsButton;
        if (!showAppsButton) return;
        const parent = showAppsButton.get_parent();
        const container = parent instanceof St.Widget ? parent : null;
        if (isHidden) showAppsButton.hide();
        else showAppsButton.show();
        if (!container) return;
        if (isHidden) container.add_style_class_name(BUTTON_CONTAINER_STYLE_CLASS);
        else container.remove_style_class_name(BUTTON_CONTAINER_STYLE_CLASS);
    }

}
