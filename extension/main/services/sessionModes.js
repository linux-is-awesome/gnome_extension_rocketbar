import Gio from 'gi://Gio';
import Context from '../core/context.js';
import { MetadataFile, SessionModesWatchdog } from '../../shared/utils/sessionModesWatchdog.js';
import { Delay, Event } from '../../shared/enums/general.js';

export default class SessionModesService {

    /** @type {Gio.FileMonitor?} */
    #extensionsMonitor = null;

    /** @type {Gio.FileMonitor?} */
    #metadataMonitor = null;

    constructor() {
        const path = Context.path;
        if (!path) return;
        const extensionsDir = Gio.File.new_for_path(path).get_parent();
        if (!extensionsDir) return;
        this.#extensionsMonitor = extensionsDir.monitor(Gio.FileMonitorFlags.NONE, null);
        Context.signals.add(this, [this.#extensionsMonitor, Event.Changed, (_, file, other, event) => {
            if (event === Gio.FileMonitorEvent.DELETED) return;
            if (!this.#isExtensionPath(file) && !this.#isExtensionPath(other)) return;
            this.#watchMetadata();
        }]);
        this.#watchMetadata(Delay.Scheduled);
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.jobs.removeAll(this);
        this.#metadataMonitor?.cancel();
        this.#extensionsMonitor?.cancel();
        this.#metadataMonitor = null;
        this.#extensionsMonitor = null;
    }

    /**
     * @param {number} [delay]
     */
    #watchMetadata(delay = Delay.Queue) {
        if (this.#metadataMonitor) {
            Context.signals.remove(this, this.#metadataMonitor);
            this.#metadataMonitor.cancel();
            this.#metadataMonitor = null;
        }
        const file = MetadataFile();
        if (!file) return;
        this.#metadataMonitor = file.monitor(Gio.FileMonitorFlags.NONE, null);
        Context.signals.add(this, [this.#metadataMonitor, Event.Changed, (_, __, ___, event) => {
            if (event === Gio.FileMonitorEvent.CHANGED ||
                event === Gio.FileMonitorEvent.DELETED) return;
            Context.jobs.replace(this, Delay.Queue).destroy(() => SessionModesWatchdog());
        }]);
        if (!file.query_exists(null)) return;
        Context.jobs.replace(this, delay).destroy(() => SessionModesWatchdog());
    }

    /**
     * @param {Gio.File?} file
     * @returns {boolean}
     */
    #isExtensionPath(file) {
        const path = Context.path;
        const target = file?.get_path();
        return !!path && !!target && target === path;
    }

}
