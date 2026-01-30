import Clutter from 'gi://Clutter';
import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import Context from '../core/context.js';

const STAGE_GRAB_FUNCTION_NAME = 'grab';

const FakePopupGrab = () => ({
    get_seat_state: () => Clutter.GrabState.KEYBOARD,
    dismiss: () => {}
});

export default class {

    constructor() {
        Context.hooks.add(this, global.stage, STAGE_GRAB_FUNCTION_NAME, (_, actor) => {
            if (actor instanceof SwitcherPopup) {
                const oldFocus = global.stage.get_key_focus() ?? null;
                global.stage.set_key_focus(actor);
                const hasFocus = actor.has_key_focus();
                global.stage.set_key_focus(oldFocus);
                if (hasFocus) return FakePopupGrab();
            }
            return undefined;
        }, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
