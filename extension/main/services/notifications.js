/**
 * @typedef {import('../../shared/core/context/jobs.js').Jobs.Job} Job
 */

import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Context from '../core/context.js';
import { MessageTray } from '../core/shell.js';
import { SettingsKey, Event, Delay } from '../../shared/core/enums.js';
import { Config } from '../../shared/utils/config.js';

const APPID_REGEXP_STRING = /.desktop/g;
const WINDOW_ATTENTION_SOURCE_CLASS = 'WindowAttentionSource';

/** @enum {string} */
const ConfigField = {
    enableLauncherApi: SettingsKey.NotificationsLauncherApi,
    countAttentionSources: SettingsKey.NotificationsCountAttentionSources
};

class NotificationService {

    /** @type {Shell.WindowTracker?} */
    #windowTracker = Shell.WindowTracker.get_default();

    /** @type {Set<MessageTray.Source>?} */
    #notifications = new Set();

    /** @type {Map<string, number>?} */
    #countByAppId = new Map();

    /** @type {Map<NotificationHandler, (count: number) => void>?} */
    #handlers = new Map();

    /** @type {number} */
    #totalCount = 0;

    /** @type {Job?} */
    #updateJob = Context.jobs.new(this, Delay.Background);

    /** @type {Config?} */
    #config = Config(this, ConfigField, () => this.#handleConfig());

    constructor() {
        this.#handleConfig();
        this.#loadNotifications();
        Context.signals.add(this, [
            MessageTray,
            Event.SourceAdded, (_, source) => this.#addNotification(source),
            Event.SourceRemoved, (_, source) => this.#removeNotification(source),
            Event.QueueChanged, () => this.#queueUpdate()
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
        this.#notifications?.clear();
        this.#notifications = null;
        this.#countByAppId = null;
        this.#handlers = null;
        this.#updateJob = null;
        this.#windowTracker = null;
        this.#config = null;
        return true;
    }

    /**
     * @param {NotificationHandler} handler
     * @param {(count: number) => void} callback
     */
    addHandler(handler, callback) {
        if (!this.#handlers || !handler || !callback) return;
        this.#handlers.set(handler, callback);
        this.#triggerHandler(handler, callback);
    }

    /**
     * @param {NotificationHandler} handler
     */
    removeHandler(handler) {
        if (!this.#handlers || !handler || !this.#handlers.has(handler)) return;
        this.#handlers.delete(handler);
    }

    #handleConfig() {
        if (!this.#config) return;
        if (!this.#config.enableLauncherApi) Context.launcherApi?.disconnect(this);
        else Context.launcherApi?.connectNotifications(this, () => this.#queueUpdate());
        this.#queueUpdate();
    }

    #loadNotifications() {
        const sources = MessageTray.getSources();
        if (!sources?.length) return;
        for (let i = 0, l = sources.length; i < l; ++i) this.#addNotification(sources[i]);
    }

    /**
     * @param {MessageTray.Source} source
     */
    #addNotification(source) {
        if (!source || !this.#notifications || this.#notifications.has(source)) return;
        this.#notifications.add(source);
        Context.signals.add(this, [source, Event.CountChanged, () => this.#queueUpdate()]);
        this.#queueUpdate();
    }

    /**
     * @param {MessageTray.Source} source
     */
    #removeNotification(source) {
        if (!this.#notifications || !this.#notifications.has(source)) return;
        this.#notifications.delete(source);
        Context.signals.remove(this, source);
        this.#queueUpdate();
    }

    #queueUpdate() {
        if (!this.#updateJob) return;
        this.#updateJob.reset().queue(() => this.#update());
    }

    #update() {
        if (!this.#handlers || !this.#notifications ||
            !this.#countByAppId || !this.#config) return;
        const { countAttentionSources } = this.#config;
        this.#totalCount = 0;
        const launcherApiCount = Context.launcherApi?.notifications;
        if (!launcherApiCount) this.#countByAppId.clear();
        else this.#countByAppId = new Map([...launcherApiCount]);
        for (const source of this.#notifications) {
            const sourceCount = source.count ?? 0;
            if (!sourceCount) continue;
            this.#totalCount += sourceCount;
            const isWindowAttentionSource = source.constructor?.name === WINDOW_ATTENTION_SOURCE_CLASS;
            if (isWindowAttentionSource && !countAttentionSources) continue;
            const sourceAppId = source.app?.id ?? source._appId ?? this.#getWindowAppId(source._window);
            if (!sourceAppId || typeof sourceAppId !== 'string') continue;
            const appId = sourceAppId.replace(APPID_REGEXP_STRING, '');
            if (!isWindowAttentionSource && launcherApiCount?.has(appId)) continue;
            const oldCount = this.#countByAppId.get(appId) ?? 0;
            this.#countByAppId.set(appId, oldCount + sourceCount);
        }
        for (const [handler, callback] of this.#handlers) this.#triggerHandler(handler, callback);
    }

    /**
     * @param {Meta.Window?} [window]
     * @returns {string?}
     */
    #getWindowAppId(window) {
        return window instanceof Meta.Window ?
               this.#windowTracker?.get_window_app(window)?.id ?? null :
               null;
    }

    /**
     * @param {NotificationHandler} handler
     * @param {(count: number) => void} callback
     */
    #triggerHandler(handler, callback) {
        const appId = handler.appId;
        if (typeof appId !== 'string') callback(this.#totalCount);
        else callback(this.#countByAppId?.get(appId) ?? 0);
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
     * @param {(count: number) => void} callback
     * @param {Shell.App?} [app]
     */
    constructor(callback, app) {
        if (typeof callback !== 'function') return;
        this.#callback = callback;
        this.#app = app instanceof Shell.App ? app : null;
        NotificationHandler.#service ??= new NotificationService();
        NotificationHandler.#service.addHandler(this, count => this.#setCount(count));
    }

    destroy() {
        this.#setCount(0);
        this.#callback = null;
        this.#app = null;
        if (!NotificationHandler.#service) return;
        NotificationHandler.#service.removeHandler(this);
        if (!NotificationHandler.#service.destroy()) return;
        NotificationHandler.#service = null;
    }

    /**
     * @param {number} count
     */
    #setCount(count) {
        if (typeof this.#callback !== 'function') return;
        if (this.#count === count) return;
        this.#count = count;
        this.#callback(count);
    }

}
