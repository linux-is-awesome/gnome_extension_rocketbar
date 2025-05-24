import Clutter from 'gi://Clutter';
import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import Context from '../core/context.js';

const FakePopupGrab = () => ({
    get_seat_state: () => Clutter.GrabState.KEYBOARD,
    dismiss: () => {}
});

export default class {

    constructor() {
        Context.hooks.add(this, global.stage, global.stage.grab,
            (_, actor) => actor instanceof SwitcherPopup ? FakePopupGrab() : undefined, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
