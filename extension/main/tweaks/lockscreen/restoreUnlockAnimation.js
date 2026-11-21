import { ScreenShield } from '../../core/shell.js';
import Context from '../../core/context.js';

export default class {

    constructor() {
        Context.hooks.add(this, ScreenShield, ScreenShield._hideLockScreen, shield => {
            shield._hideLockScreenComplete();
            shield._showPointer();
            return true;
        }, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
