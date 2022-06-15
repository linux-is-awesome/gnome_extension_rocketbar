const Main = imports.ui.main;
const { GLib } = imports.gi;

// TODO: ui.windowAttentionHandler.WindowAttentionSource // want to handle?
//       ui.messageTray.SystemNotificationSource // just count, not for apps?
//       ui.notificationDaemon.FdoNotificationDaemonSource // main for apps?
//       ui.notificationDaemon.GtkNotificationDaemonAppSource // calendar notifications?

var NotificationHandler = class NotificationHandler {

    // don't destroy this map while extension is enabled
    static _notificationsCache = new Map(); // Map: appId => { appButton: appButton, count: int }

    static addAppButton(source) {

        if (!NotificationHandler._notificationsCache ||
                !source || !source.appId || !source.setNotifications) {
            return;
        }

        // check if app id of the button exists in the cache
        let cacheForAppId = NotificationHandler._notificationsCache.get(source.appId);

        // if there is no cache - create it
        if (!cacheForAppId) {

            cacheForAppId = { count: 0 };

            NotificationHandler._notificationsCache.set(source.appId, cacheForAppId);
        }

        // set app button
        cacheForAppId.appButton = source;

        // handle the app button destroy
        source.connect('destroy', () => {

            if (!NotificationHandler._notificationsCache) {
                return;
            }

            cacheForAppId.appButton = null;
        });

        // check if there are notifications for the app button
        // if so then send count to the button
        if (cacheForAppId.count) {
            source.setNotifications(cacheForAppId.count);
        }
    }

    // should be used only in case the extension becomes disabled
    static destroyCache() {
        NotificationHandler._notificationsCache = null;
    }

    constructor(callback) {

        this._callback = callback;

        if (!NotificationHandler._notificationsCache) {
            NotificationHandler._notificationsCache = new Map();
        }

        this._createSources();

        this._createConnections();
    }

    destroy() {

        this._stopUpdateCountQueue();
        
        this._connections.forEach(id => Main.messageTray.disconnect(id));
        this._connections = null;

        this._updateNotificationsCache();
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
        this._updateCountTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            
            this._updateCountTimeout = null;
            
            this._updateCount();

            return GLib.SOURCE_REMOVE;
        });
    }

    _stopUpdateCountQueue() {
        if (this._updateCountTimeout) {
            GLib.source_remove(this._updateCountTimeout);
            this._updateCountTimeout = null;
        }
    }

    _updateCount() {

        let totalCount = 0;

        let countByAppId = new Map();

        const sources = [...this._sources.keys()];        

        for (let i = 0, l = sources.length; i < l; ++i) {

            const source = sources[i];
            const sourceCount = source.count || 0;

            totalCount += sourceCount;

            // count notifications for apps

            if (!source.app || !source.app.id) {
                continue;
            }

            let countForApp = countByAppId.get(source.app.id) || 0;

            countForApp += sourceCount;
            
            if (countForApp === 0) {
                continue;
            }

            countByAppId.set(source.app.id, countForApp);
        }

        // return total count
        if (this._callback) {
            this._callback(totalCount);
        }

        this._updateNotificationsCache(countByAppId);
    }

    _updateNotificationsCache(countByAppId = new Map()) {

        if (!NotificationHandler._notificationsCache) {
            return;
        }

        const appIds = [...NotificationHandler._notificationsCache.keys()];

        for (let i = 0, l = appIds.length; i < l; ++i) {

            const appId = appIds[i];

            const count = countByAppId.get(appId) || 0;

            const cacheForAppId = NotificationHandler._notificationsCache.get(appId);

            // add cache for the app Id if count is not 0
            if (!cacheForAppId) {

                if (count) {
                    NotificationHandler._notificationsCache.set(appId, { count: count });
                }

                continue;
            }

            // notify app button about notifications count changes
            if (cacheForAppId.appButton && cacheForAppId.count !== count) {

                cacheForAppId.count = count;

                cacheForAppId.appButton.setNotifications(count);

                continue;
            }

            // if there is no app button and count is 0 
            // remove cache for the app id
            if (!cacheForAppId.appButton && !count) {

                NotificationHandler._notificationsCache.delete(appId);

                continue;
            }

            cacheForAppId.count = count;
        }
    }

}