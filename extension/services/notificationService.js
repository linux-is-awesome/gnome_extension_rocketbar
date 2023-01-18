/* exported NotificationHandler */

import { Main } from '../core/legacy.js';
import { Context } from '../core/context.js'
import { Type, Delay } from '../core/enums.js'
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
    QueueChanged: 'queue-changed'
};

/** @enum {string} */
const NotificationSource = {
    FdoNotification: 'FdoNotificationDaemonSource',
    GtkNotification: 'GtkNotificationDaemonAppSource',
    WindowAttention: 'WindowAttentionSource'
};

class LauncherApiConnector {

    /** @type {Map<string, number>} */
    static #countByAppId = null;

    /** @type {() => void} */
    #callback = null;

    /** @type {Map<string, number>} */
    get count() {
        return LauncherApiConnector.#countByAppId;
    }

    /**
     * @param {() => void} callback
     */
    constructor(callback) {
        this.#callback = callback;
        if (!LauncherApiConnector.#countByAppId) {
            LauncherApiConnector.#countByAppId = new Map();
        } else this.#triggerCallback();
        Context.launcherAPI.connect(this, params => this.#update(params));
    }

    destroy() {
        Context.launcherAPI.disconnect(this);
        this.#callback = null;
    }

    /**
     * @param {GLib.Variant} params
     */
    #update(params) {
        if (!LauncherApiConnector.#countByAppId || !params) return;
        const [ appUri, props ] = params.deepUnpack();
        const appId = appUri?.replace(/(^\w+:|^)\/\//, '');
        if (!appId || !props) return;
        const countByAppId = LauncherApiConnector.#countByAppId;
        const count = props['count']?.get_int64() ?? 0;
        const countVisible = props['count-visible']?.get_boolean() ?? false;
        if (count && countVisible) countByAppId.set(appId, count);
        else if (!countByAppId.has(appId)) return;
        else countByAppId.delete(appId);
        this.#triggerCallback();
    }

    #triggerCallback() {
        if (typeof this.#callback === Type.Function) this.#callback();
    }

}

class NotificationService {

    #notificationSourceAppId = (source) => ({
        [NotificationSource.FdoNotification]: source.app?.id,
        [NotificationSource.GtkNotification]: source._appId,
        [NotificationSource.WindowAttention]: source._app?.id
    })[source.constructor?.name];

    #sources = new Map();

    #handlers = new Set();

    #countByAppId = new Map();

    #totalCount = 0;

    #launcherApiConnector = null;

    #updateJob = Context.jobs.new(this, Delay.Background);

    #config = Config(this, ConfigFields, () => this.#handleConfig().#queueUpdate());

    get isEmpty() {
        return !this.#handlers?.size;
    }

    constructor() {
        this.#handleConfig();
        this.#initSources();
        Context.signals.add(this, [
            [Main.messageTray, [MessageTrayEvent.SourceAdded], (_, source) => this.#addSource(source)],
            [Main.messageTray, [MessageTrayEvent.SourceRemoved], (_, source) => this.#removeSource(source)],
            [Main.messageTray, [MessageTrayEvent.QueueChanged], () => this.#queueUpdate()]
        ]);
    }

    destroy() {
        this.#updateJob?.destroy();
        Context.signals.removeAll(this);
        this.#launcherApiConnector?.destroy();
        this.#handlers = null;
    }

    addHandler(handler) {
        if (!this.#handlers || handler instanceof NotificationHandler === false) return;
        this.#handlers.add(handler);
        this.#triggerHandler(handler);
    }

    removeHandler(handler) {
        if (!handler || !this.#handlers?.has(handler)) return;
        this.#handlers.delete(handler);
    }

    #handleConfig() {
        if (this.#config.enableLauncherApi && !this.#launcherApiConnector) {
            this.#launcherApiConnector = new LauncherApiConnector(() => this.#queueUpdate());
        } else if (!this.#config.enableLauncherApi && this.launcherApiConnector) {
            this.#launcherApiConnector.destroy();
            this.#launcherApiConnector = null;
        }
        return this;
    }

    #initSources() {
        const sources = Main.messageTray?.getSources();
        if (!sources?.length) return;
        for (let i = 0, l = sources.length; i < l; ++i) this.#addSource(sources[i]);
    }

    #addSource(source) {
        if (this.#sources.has(source)) return;
        if (typeof source?.connect !== Type.Function) return;
        this.#sources.set(source, source.connect('notify::count', () => this.#queueUpdate()));
        this.#queueUpdate();
    }

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
        const launcherApiCount = this.#launcherApiConnector?.count;
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
        console.log('Update notifications');
        this.#triggerHandlers();
    }

    #triggerHandlers() {
        for (const handler of this.#handlers) this.#triggerHandler(handler);
    }

    #triggerHandler(handler) {
        if (typeof handler.appId !== Type.String) handler.setCount(this.#totalCount);
        else handler.setCount(this.#countByAppId.get(handler.appId) ?? 0);
    }
}

export class NotificationHandler {

    static #service = null;

    #callback = null;

    #appId = null;

    get appId() {
        return this.#appId;
    }

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
        if (!NotificationHandler.#service?.isEmpty) return;
        NotificationHandler.#service.destroy();
        NotificationHandler.#service = null;
    }

    setCount(count) {
        if (typeof this.#callback !== Type.Function) return; 
        this.#callback(count);
    }

}
