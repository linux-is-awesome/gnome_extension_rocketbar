/* exported MenuTrigger */

/**
 * @typedef {import('./appButton.js').AppButton} AppButton
 */

import St from 'gi://St';
import { AppMenu } from '../../core/legacy.js';
import { Context } from '../../core/context.js';
import { Event } from '../../core/enums.js';

/** @type {Object.<string, boolean>} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindows: true
};

export class Menu extends AppMenu {

    /** @type {AppButton} */
    #appButton = null;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton.actor, St.Side.TOP, DefaultProps);
        this.#appButton = appButton;
        this.setApp(appButton.app);
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions.
     *       
     */
    destroy() {
        this.close(false);
        this._app?.disconnectObject(this);
        this._app = null;
        super.destroy();
    }

}
