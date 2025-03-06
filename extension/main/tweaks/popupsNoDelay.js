import { SwitcherPopup } from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import Context from '../core/context.js';

export default class {

    constructor() {
        const prototype = SwitcherPopup.prototype;
        Context.hooks.add(this, prototype, prototype.show,
            (sender, result) => (result && sender._showImmediately(), result));
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
