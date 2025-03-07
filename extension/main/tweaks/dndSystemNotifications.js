import { Source, Urgency } from 'resource:///org/gnome/shell/ui/messageTray.js';
import Context from '../core/context.js';
import { Property } from '../../shared/core/enums.js';

/** @type {{[key: string]: *}} */
const PropertyDescriptor = {
    value: true,
    writable: true
};

export default class {

    constructor() {
        const prototype = Source.prototype;
        Context.hooks.add(this, prototype, prototype.addNotification, (target, notification) => {
            if (target?.constructor?.name !== Source.name ||
                notification?.urgency === Urgency.CRITICAL ||
                target.policy.showBanners) return;
            Object.defineProperty(target.policy, Property.ShowBanners, PropertyDescriptor);
        }, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
