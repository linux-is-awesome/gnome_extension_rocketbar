/**
 * @typedef {import('resource:///org/gnome/shell/ui/status/keyboard.js').InputSourceManager} InputSourceManager
 */

import St from 'gi://St';
import { getInputSourceManager as InputSourceManager } from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { Overview } from '../core/shell.js';
import Context from '../core/context.js';
import { Event } from '../../shared/core/enums.js';

const PRIMARY_INPUT_SOURCE = '0';

export default class {

    /** @type {InputSourceManager?} */
    #inputSourceManager = InputSourceManager();

    constructor() {
        const prototype = St.PasswordEntry.prototype;
        Context.hooks.add(this, prototype, prototype.grab_key_focus,
            sender => this.#activatePrimaryInputSource(sender), true);
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.hooks.removeAll(this);
        this.#inputSourceManager = null;
    }

    /**
     * @param {St.PasswordEntry} sender
     */
    #activatePrimaryInputSource(sender) {
        if (!this.#inputSourceManager) return;
        const inputSourceManager = this.#inputSourceManager;
        const primaryInputSource = inputSourceManager.inputSources[PRIMARY_INPUT_SOURCE];
        if (!primaryInputSource ||
            inputSourceManager._currentSource === primaryInputSource) return;
        Context.signals.add(this, [sender, Event.Destroy, () => {
            Context.signals.remove(this, sender);
            inputSourceManager._sourcesPerWindowChanged();
            if (inputSourceManager._sourcesPerWindow) inputSourceManager._setPerWindowInputSource();
        }]);
        if (inputSourceManager._focusWindowNotifyId) {
            Overview.disconnectObject(inputSourceManager);
            global.display.disconnect(inputSourceManager._focusWindowNotifyId);
            inputSourceManager._focusWindowNotifyId = 0;
            inputSourceManager._sourcesPerWindow = false;
        }
        primaryInputSource.activate();
    }

}
