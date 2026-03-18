import { Source, Urgency } from 'resource:///org/gnome/shell/ui/messageTray.js';
import Context from '../../core/context.js';
import { Property } from '../../../shared/enums/general.js';

/** @type {{[key: string]: *}} */
const PropertyDescriptor = {
    value: true,
    writable: true
};

export default class {

    constructor() {
        const prototype = Source.prototype;
        Context.hooks.add(this, prototype, prototype.addNotification, (source, notification) => {
            if (source?.constructor?.name !== Source.name ||
                notification?.urgency === Urgency.CRITICAL ||
                source.policy.showBanners) return;
            Object.defineProperty(source.policy, Property.ShowBanners, PropertyDescriptor);
        }, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
