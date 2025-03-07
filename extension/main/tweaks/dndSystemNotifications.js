import { Source, Urgency } from 'resource:///org/gnome/shell/ui/messageTray.js';
import Context from '../core/context.js';

export default class {

    constructor() {
        const prototype = Source.prototype;
        Context.hooks.add(this, prototype, prototype.addNotification, (target, notification) => {
            if (!notification || target.constructor.name !== Source.name) return;
            notification.urgency = Urgency.CRITICAL;
        }, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
