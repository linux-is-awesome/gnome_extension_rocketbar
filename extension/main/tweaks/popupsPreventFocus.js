import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import Context from '../core/context.js';

export default class {

    constructor() {
        Context.hooks.add(this, global.stage, global.stage.set_key_focus,
            (_, actor) => actor instanceof SwitcherPopup || undefined, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
