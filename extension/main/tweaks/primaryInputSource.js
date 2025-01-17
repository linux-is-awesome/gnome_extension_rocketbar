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

    /** @type {(() => void)?} */
    #backup = null;

    constructor() {
        const callback = sender => this.#activatePrimaryInputSource(sender);
        const originFunction = St.PasswordEntry.prototype.grab_key_focus;
        St.PasswordEntry.prototype.grab_key_focus = function () {
            callback(this);
            originFunction.call(this);
        };
        this.#backup = originFunction;
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#inputSourceManager = null;
        if (typeof this.#backup !== 'function') return;
        St.PasswordEntry.prototype.grab_key_focus = this.#backup;
        this.#backup = null;
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
