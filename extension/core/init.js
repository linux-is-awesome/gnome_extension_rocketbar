import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Unit from './unit.js';
import { SessionMode } from './enums.js';

export default class extends Unit {

    constructor() {
        super();
    }

    /**
     * TODO: improve current mode validation
     * 
     * @returns {boolean}
     */
    destroy() {
        if (Main.sessionMode.currentMode === SessionMode.Locksreen) return false;
        return true;
    }

}
