/* exported NotificationHandler */

import { Main } from '../core/legacy.js';
import { Context } from '../core/context.js';
import { Type, Delay } from '../core/enums.js';
import { Config } from '../utils/config.js';

/** @enum {string} */
const ConfigFields = {
    enableLauncherApi: 'notification-service-enable-unity-dbus',
    countAttentionSources: 'notification-service-count-attention-sources'
};

/** @enum {string} */
const MessageTrayEvent = {
    SourceAdded: 'source-added',
    SourceRemoved: 'source-removed',
    QueueChanged: 'queue-changed',
    CountChanged: 'notify::count'
};

/** @enum {string} */
const NotificationSource = {
    FdoNotification: 'FdoNotificationDaemonSource',
    GtkNotification: 'GtkNotificationDaemonAppSource',
    WindowAttention: 'WindowAttentionSource'
};

class NotificationService {

    /**
     * Known Issue: FdoNotification source may not have appId in some case.
     *              As an example: Thunderbird notifications when using SysTray-X addon.
     *              As a workaround for such cases pid can be used to count app notifications.
     *              This requires passing pid along with appId to the NotificationHandler.
     *              Unfortunatly I haven't found a simple way to get appId using pid while updating counts
     *              without hurting Shell performance (i.e. GLib.spawn_command_line_sync)
     *              or adding too much complexity to the code.
     * 
     * TODO: Count app notifications by pid when appId is not provided.
     *              
     * @param {MessageTray.Source} source
     * @returns {string|null}
     */
    #notificationSourceAppId = (source) => ({
        [NotificationSource.FdoNotification]: source.app?.id,
        [NotificationSource.GtkNotification]: source._appId,
        [NotificationSource.WindowAttention]: source._app?.id
    })[source.constructor?.name];

    /** @type {Map<MessageTray.Source, number>} */
    #sources = new Map();

    /** @type {Set<NotificationHandler>} */
    #handlers = new Set();

    /** @type {Map<string, number>} */
    #countByAppId = new Map();

    /** @type {number} */
    #totalCount = 0;

    /** @type {Job} */
    #updateJob = Context.jobs.new(this, Delay.Background);

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /** @type {boolean} */
    get wantsDestroy() {
        return !this.#handlers?.size;
    }

    constructor() {
        this.#handleConfig();
        this.#initSources();
        Context.signals.add(this, [
            Main.messageTray,
            MessageTrayEvent.SourceAdded, (_, source) => this.#addSource(source),
            MessageTrayEvent.SourceRemoved, (_, source) => this.#removeSource(source),
            MessageTrayEvent.QueueChanged, () => this.#queueUpdate()
        ]);
    }

    destroy() {
        this.#updateJob?.destroy();
        Context.signals.removeAll(this);
        this.#handlers = null;
    }

    /**
     * @param {NotificationHandler} handler 
     */
    addHandler(handler) {
        if (!this.#handlers || handler instanceof NotificationHandler === false) return;
        this.#handlers.add(handler);
        this.#triggerHandler(handler);
    }

    /**
     * @param {NotificationHandler} handler 
     */
    removeHandler(handler) {
        if (!handler || !this.#handlers?.has(handler)) return;
        this.#handlers.delete(handler);
    }

    /**
     * @param {string} settingsKey 
     */
    #handleConfig(settingsKey) {
        if (settingsKey === ConfigFields.countAttentionSources) return this.#queueUpdate();
        if (this.#config.enableLauncherApi) Context.launcherApi?.connect(this, () => this.#queueUpdate());
        else Context.launcherApi?.disconnect(this);
        this.#queueUpdate();
    }

    #initSources() {
        const sources = Main.messageTray?.getSources();
        if (!sources?.length) return;
        for (let i = 0, l = sources.length; i < l; ++i) this.#addSource(sources[i]);
    }

    /**
     * @param {MessageTray.Source} source
     */
    #addSource(source) {
        if (this.#sources.has(source)) return;
        if (typeof source?.connect !== Type.Function) return;
        this.#sources.set(source, source.connect(MessageTrayEvent.CountChanged, () => this.#queueUpdate()));
        this.#queueUpdate();
    }

    /**
     * @param {MessageTray.Source} source
     */
    #removeSource(source) {
        if (!this.#sources.has(source)) return;
        if (typeof source.disconnect === Type.Function) source.disconnect(this.#sources.get(source));
        this.#sources.delete(source);
        this.#queueUpdate();
    }

    #queueUpdate() {
        this.#updateJob.reset().then(() => this.#update());
    }

    #update() {
        if (!this.#handlers) return;
        this.#totalCount = 0;
        const launcherApiCount = Context.launcherApi?.notifications;
        if (!launcherApiCount) this.#countByAppId.clear();
        else this.#countByAppId = new Map([...launcherApiCount]);
        const sources = [...this.#sources.keys()];
        for (let i = 0, l = sources.length; i < l; ++i) {
            const source = sources[i];
            const sourceCount = source.count ?? 0;
            this.#totalCount += sourceCount;
            let appId = this.#notificationSourceAppId(source);
            if (!appId || launcherApiCount?.has(appId)) continue;
            let countForApp = this.#countByAppId.get(appId) ?? 0;
            countForApp += sourceCount;
            if (!countForApp) continue;
            this.#countByAppId.set(appId, countForApp);
        }
        this.#triggerHandlers();
    }

    #triggerHandlers() {
        for (const handler of this.#handlers) this.#triggerHandler(handler);
    }

    /**
     * @param {NotificationHandler} handler 
     */
    #triggerHandler(handler) {
        if (typeof handler.appId !== Type.String) handler.setCount(this.#totalCount);
        else handler.setCount(this.#countByAppId.get(handler.appId) ?? 0);
    }

}

/**
 * TODO: Pass pid along with appId to the handler.
 */
export class NotificationHandler {

    /** @type {NotificationService} */
    static #service = null;

    /** @type {(count: number) => void} */
    #callback = null;

    /** @type {string|null} */
    #appId = null;

    /** @type {string|null} */
    get appId() {
        return this.#appId;
    }

    /**
     * @param {(count: number) => void} callback
     * @param {string} [appId]
     */
    constructor(callback, appId) {
        if (typeof callback !== Type.Function) return; 
        this.#callback = callback;
        if (typeof appId === Type.String) {
            this.#appId = appId;
        }
        if (!NotificationHandler.#service) {
            NotificationHandler.#service = new NotificationService();
        }
        NotificationHandler.#service.addHandler(this);
    }

    destroy() {
        this.setCount(0);
        this.#callback = null;
        this.#appId = null; 
        NotificationHandler.#service?.removeHandler(this);
        if (!NotificationHandler.#service?.wantsDestroy) return;
        NotificationHandler.#service.destroy();
        NotificationHandler.#service = null;
    }

    /**
     * @param {number} count
     */
    setCount(count) {
        if (typeof this.#callback !== Type.Function) return; 
        this.#callback(count);
    }

}
