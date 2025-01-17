import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';

export default class {

    constructor() {
        global.stage.set_key_focus = actor => {
            if (actor instanceof SwitcherPopup) return;
            global.stage.constructor.prototype.set_key_focus.call(global.stage, actor);
        };
    }

    destroy() {
        global.stage.set_key_focus = global.stage.constructor.prototype.set_key_focus;
    }

}
