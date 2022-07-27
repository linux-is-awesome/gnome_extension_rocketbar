/* exported NotificationHandler */

//#region imports

const Main = imports.ui.main;
const { FdoNotificationDaemonSource, GtkNotificationDaemonAppSource } = imports.ui.notificationDaemon;
const { WindowAttentionSource } = imports.ui.windowAttentionHandler;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { Timeout } = Me.imports.utils.timeout;

//#endregion imports

class NotificationService {

    constructor() {
        this._handlers = []; // [NotificationHandler...]

        this._resetCounts();

        this._createSources();

        this._createConnections();
    }

    addHandler(handler) {

        if (!handler) {
            return;
        }

        this._handlers.push(handler);

        this._triggerHandler(handler);
    }

    removeHandler(handler) {

        if (!handler) {
            return;
        }

        const handlerIndex = this._handlers.indexOf(handler);

        if (handlerIndex < 0) {
            return;
        }

        this._handlers.splice(handlerIndex, 1);
    }

    isEmpty() {
        return !this._handlers.length;
    }

    destroy() {

        this._stopUpdateCountQueue();

        this._connections.forEach(id => Main.messageTray.disconnect(id));
    }

    _createSources() {

        this._sources = new Map(); // source => connection id

        const messageTraySources = Main.messageTray.getSources();

        if (!messageTraySources.length) {
            return;
        }

        for (let i = 0, l = messageTraySources.length; i < l; ++i) {
            this._addSource(messageTraySources[i]);
        }
    }

    _createConnections() {
        this._connections = [
            Main.messageTray.connect('source-added', (tray, source) => this._addSource(source)),
            Main.messageTray.connect('source-removed', (tray, source) => this._removeSource(source)),
            Main.messageTray.connect('queue-changed', () => this._queueUpdateCount())
        ];
    }

    _addSource(source) {

        if (!this._sources.has(source)) {
            this._sources.set(source, source.connect('notify::count', () => this._queueUpdateCount()));
        }

        this._queueUpdateCount();
    }

    _removeSource(source) {

        if (this._sources.has(source)) {
            source.disconnect(this._sources.get(source));
            this._sources.delete(source);
        }
 
        this._queueUpdateCount();
    }

    _queueUpdateCount() {

        this._stopUpdateCountQueue();

        // slow down it a bit
        // I believe we can wait for 500 ms to get notifications
        this._updateCountTimeout = Timeout.idle(500).run(() => {
            this._updateCountTimeout = null;
            this._updateCount();
        });
    }

    _stopUpdateCountQueue() {
        this._updateCountTimeout?.destroy();
        this._updateCountTimeout = null;
    }

    _updateCount() {

        this._resetCounts();

        const sources = [...this._sources.keys()];        

        for (let i = 0, l = sources.length; i < l; ++i) {

            const source = sources[i];
            const sourceCount = source.count || 0;

            this._totalCount += sourceCount;

            // count notifications for apps

            let appId = null;

            if (source instanceof FdoNotificationDaemonSource) {
                appId = source.app ? source.app.id : null;
            } else if (source instanceof GtkNotificationDaemonAppSource) {
                appId = source._appId;
            } else if (source instanceof WindowAttentionSource) {
                appId = source._app ? source._app.id : null;
            } else {
                continue;
            }

            if (!appId) {
                continue;
            }

            let countForApp = this._countByAppId.get(appId) || 0;

            countForApp += sourceCount;
            
            if (countForApp === 0) {
                continue;
            }

            this._countByAppId.set(appId, countForApp);
        }

        this._triggerHandlers();
    }

    _resetCounts() {
        this._totalCount = 0;
        this._countByAppId = new Map();
    }

    _triggerHandlers() {
        for (let i = 0, l = this._handlers.length; i < l; ++i) {
            this._triggerHandler(this._handlers[i]);
        }
    }

    _triggerHandler(handler) {

        if (!handler.appId) {
            handler.setCount(this._totalCount);
            return;
        }

        handler.setCount(this._countByAppId.get(handler.appId) || 0);
    }
}

var NotificationHandler = class {

    // static instance of NotificationService
    static _service = null;

    /*
     * callback: (count) => {} to notify handler target about notifications
     * appId: optional string value to filter notifications by app Id, null to get total count
     */
    constructor(callback, appId) {
        
        this.appId = appId;

        this._callback = callback;

        if (!NotificationHandler._service) {
            NotificationHandler._service = new NotificationService();
        }

        NotificationHandler._service.addHandler(this);
    }

    destroy() {

        this.setCount(0);

        this._callback = null;

        if (!NotificationHandler._service) {
            return;
        }

        NotificationHandler._service.removeHandler(this);

        if (NotificationHandler._service.isEmpty()) {
            NotificationHandler._service.destroy();
            NotificationHandler._service = null;
        }
    }

    setCount(count) {

        if (!this._callback) {
            return;
        }

        this._callback(count);
    }

}
