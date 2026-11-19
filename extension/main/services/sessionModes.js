import Gio from 'gi://Gio';
import Context from '../core/context.js';
import { MetadataFile, SessionModesWatchdog } from '../../shared/utils/sessionModesWatchdog.js';
import { Event } from '../../shared/enums/general.js';

export default class SessionModesService {

    /** @type {Gio.FileMonitor?} */
    #monitor = null;

    constructor() {
        const file = MetadataFile();
        if (!file) return;
        this.#monitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
        Context.signals.add(this, [this.#monitor, Event.Changed, (_, __, ___, event) => {
            if (event === Gio.FileMonitorEvent.CHANGED) return;
            SessionModesWatchdog();
        }]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#monitor?.cancel();
        this.#monitor = null;
    }

}
