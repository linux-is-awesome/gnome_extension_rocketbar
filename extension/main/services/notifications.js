/**
 * @typedef {import('../../shared/core/context/jobs.js').Jobs.Job} Job
 */

import Shell from 'gi://Shell';
import Context from '../core/context.js';
import { MessageTray } from '../core/shell.js';
import { Delay } from '../../shared/core/enums.js';
import { Config } from '../../shared/utils/config.js';

const APPID_REGEXP_STRING = /.desktop/g;

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
     * @param {MessageTray.Source} source
     * @returns {string?}
     */
    #notificationAppId = source => ({
        [NotificationSource.FdoNotification]: source.app?.id,
        [NotificationSource.GtkNotification]: source._appId,
        [NotificationSource.WindowAttention]: source._app?.id
    })[source.constructor?.name]?.replace(APPID_REGEXP_STRING, '');

    /** @type {Set<MessageTray.Source>} */
    #notifications = new Set();

    /** @type {Set<NotificationHandler>?} */
    #handlers = new Set();

    /** @type {Map<string|number, number>} */
    #countForApps = new Map();

    /** @type {boolean} */
    #hasCountByPid = false;

    /** @type {number} */
    #totalCount = 0;

    /** @type {Job?} */
    #updateJob = Context.jobs.new(this, Delay.Background);

    /** @type {Config} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    constructor() {
        this.#handleConfig();
        this.#initNotifications();
        Context.signals.add(this, [
            MessageTray,
            MessageTrayEvent.SourceAdded, (_, source) => this.#addNotification(source),
            MessageTrayEvent.SourceRemoved, (_, source) => this.#removeNotification(source),
            MessageTrayEvent.QueueChanged, () => this.#queueUpdate()
        ]);
    }

    /**
     * @returns {boolean}
     */
    destroy() {
        if (this.#handlers?.size) return false;
        this.#updateJob?.destroy();
        Context.signals.removeAll(this);
        Context.launcherApi?.disconnect(this);
        this.#handlers = null;
        this.#updateJob = null;
        return true;
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
     * @param {NotificationHandler} handler
     */
    triggerHandler(handler) {
        if (!handler || !this.#handlers?.has(handler)) return;
        this.#triggerHandler(handler);
    }

    /**
     * @param {string} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (settingsKey === ConfigFields.countAttentionSources) return this.#queueUpdate();
        if (this.#config.enableLauncherApi) Context.launcherApi?.connectNotifications(this, () => this.#queueUpdate());
        else Context.launcherApi?.disconnect(this);
        this.#queueUpdate();
    }

    #initNotifications() {
        const sources = MessageTray.getSources();
        if (!sources?.length) return;
        for (let i = 0, l = sources.length; i < l; ++i) this.#addNotification(sources[i]);
    }

    /**
     * @param {MessageTray.Source} source
     */
    #addNotification(source) {
        if (this.#notifications.has(source)) return;
        this.#notifications.add(source);
        Context.signals.add(this, [source, MessageTrayEvent.CountChanged, () => this.#queueUpdate()]);
        this.#queueUpdate();
    }

    /**
     * @param {MessageTray.Source} source
     */
    #removeNotification(source) {
        if (!this.#notifications.has(source)) return;
        this.#notifications.delete(source);
        Context.signals.remove(this, source);
        this.#queueUpdate();
    }

    #queueUpdate() {
        if (!this.#updateJob) return;
        this.#updateJob.reset().queue(() => this.#update());
    }

    /**
     * Note: FdoNotification source may not have appId in some cases.
     *       As an example: Thunderbird notifications when using SysTray-X addon.
     *       As a workaround for such cases pid can be used to count app notifications.
     *       For Flatpak apps dbus access in required to count notifications for them.
     */
    #update() {
        if (!this.#handlers) return;
        this.#totalCount = 0;
        this.#hasCountByPid = false;
        const launcherApiCount = Context.launcherApi?.notifications;
        if (!launcherApiCount) this.#countForApps.clear();
        else this.#countForApps = new Map([...launcherApiCount]);
        for (const source of this.#notifications) {
            const sourceCount = source.count ?? 0;
            if (!sourceCount) continue;
            this.#totalCount += sourceCount;
            const appId = this.#notificationAppId(source);
            if (appId && launcherApiCount?.has(appId)) continue;
            if (appId) {
                const countForApp = this.#countForApps.get(appId) ?? 0;
                this.#countForApps.set(appId, countForApp + sourceCount);
            }
            if (source.pid) {
                const countForApp = this.#countForApps.get(source.pid) ?? 0;
                this.#countForApps.set(source.pid, countForApp + sourceCount);
                this.#hasCountByPid = true;
            }
        }
        for (const handler of this.#handlers) this.#triggerHandler(handler);
    }

    /**
     * Note: Count notifications by pid as a backup option.
     *       This workaround helps with Thunderbird notifications when using SysTray-X addon.
     *       Probably can be useful for other apps as well.
     *       It doesn't allow to count notifications for separate Chrome windows separately.
     *       Doesn't help to count notifications for Flatpak apps without dbus access.
     *
     * @param {NotificationHandler} handler
     */
    #triggerHandler(handler) {
        const appId = handler.appId;
        if (typeof appId !== 'string') return handler.setCount(this.#totalCount);
        let count = this.#countForApps.get(appId) ?? 0;
        if (count || !this.#hasCountByPid) return handler.setCount(count);
        const pids = handler.pids;
        if (!pids?.length) return handler.setCount(count);
        for (let i = 0, l = pids.length; i < l; ++i) {
            count += this.#countForApps.get(pids[i]) ?? 0;
        }
        handler.setCount(count);
    }

}

export class NotificationHandler {

    /** @type {NotificationService?} */
    static #service = null;

    /** @type {((count: number) => void)?} */
    #callback = null;

    /** @type {Shell.App?} */
    #app = null;

    /** @type {string?} */
    #appId = null;

    /** @type {number[]?} */
    #pids = null;

    /** @type {number?} */
    #count = null;

    /** @type {string?} */
    get appId() {
        if (!this.#app) return null;
        if (this.#appId) return this.#appId;
        this.#appId = this.#app.id?.replace(APPID_REGEXP_STRING, '') ?? null;
        return this.#appId;
    }

    /**
     * @type {number[]?}
     */
    get pids() {
        if (this.#pids?.length) return this.#pids;
        if (!this.appId) return null;
        return Context.getStorage(this.constructor.name).get(this.#appId);
    }

    /**
     * @param {(count: number) => void} callback
     * @param {Shell.App?} [app]
     */
    constructor(callback, app) {
        if (typeof callback !== 'function') return;
        this.#callback = callback;
        this.#app = app instanceof Shell.App ? app : null;
        NotificationHandler.#service ??= new NotificationService();
        NotificationHandler.#service.addHandler(this);
    }

    destroy() {
        this.setCount(0);
        this.#callback = null;
        this.#app = null;
        if (!NotificationHandler.#service) return;
        NotificationHandler.#service.removeHandler(this);
        if (!NotificationHandler.#service.destroy()) return;
        NotificationHandler.#service = null;
    }

    /**
     * Note: This is a special function to call outside this class and catch pids of the running app.
     *       So basically the app should be running at some point, otherwise it may not get notifications count.
     *       Usually all windows of a single app share the same pid.
     */
    updatePids() {
        if (!this.appId) return;
        const oldPids = this.#pids ?? [];
        this.#pids = this.#app?.get_pids() ?? null;
        if (!this.#pids?.length) return;
        if (`${oldPids}` === `${this.#pids}`) return;
        Context.getStorage(this.constructor.name).set(this.#appId, this.#pids);
        NotificationHandler.#service?.triggerHandler(this);
    }

    /**
     * @param {number} count
     */
    setCount(count) {
        if (typeof this.#callback !== 'function') return;
        if (this.#count === count) return;
        this.#count = count;
        this.#callback(count);
    }

}
