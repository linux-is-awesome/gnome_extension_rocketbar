//#region imports

const { Clutter, GLib, GObject, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButton } = Me.imports.appButton;

//#endregion imports

var Taskbar = GObject.registerClass(
    class Taskbar extends St.ScrollView {

        //#region public methods

        getSessionCache() {
            return {
                runningAppsByWorkspace: (
                    this._runningAppsByWorkspace && this._runningAppsByWorkspace.length ?
                    this._runningAppsByWorkspace :
                    null
                )
            };
        }

        //#endregion public methods

        //#region private methods

        _init(settings, sessionCache) {

            // init scroll view
            super._init({
                name: 'taskbar', 
                style_class: 'hfade'
            });
            this.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.NEVER);
            this.clip_to_allocation = true;

            // hide default app button in the panel
            Main.panel.statusArea.appMenu.container.hide();

            // set properties
            this._appSystem = Shell.AppSystem.get_default();
            this._settings = settings;

            // restore cached data
            this._restoreSessionCache(sessionCache);

            // idenitify initial configuration
            this._setConfig();

            // create layout
            this._createLayout();

            // put the taskbar into the panel
            this._addToPanel();

            // create connections
            this._createConnections();

            // init deferred work with a small delay
            this._initTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._workId = Main.initializeDeferredWork(this, () => this._render());
                this._initTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _restoreSessionCache(sessionCache) {

            if (!sessionCache) {
                return;
            }

            this._runningAppsByWorkspace = sessionCache.runningAppsByWorkspace || null;
        }

        _setConfig() {
            this._config = {
                showFavorites: true,
                // index to display the taskbar in the panel
                // display after Activities button by default
                panelIndex: 1,
                // position to display the taskbar in the panel
                // left box by default
                // possible options: left, center
                panelPosition: 'left'
            };
        }

        _createLayout() {

            // create a parent for app buttons
            this._layout = new St.BoxLayout({
                name: 'taskbar-layout',
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.FILL,
                y_align: Clutter.ActorAlign.FILL
            });

            // add functions visible for app buttons
            this._layout.setActiveAppButton = appButton => this._setActiveAppButton(appButton);
            this._layout.handleAppButtonPosition = appButton => this._handleAppButtonPosition(appButton);
            this._layout.scrollToAppButton = appButton => this._scrollToAppButton(appButton);
            this._layout.setScrollLock = (appButton, locked) => this._setScrollLock(appButton, locked);

            this.add_actor(this._layout);
        }

        _createConnections() {
            // internal connections
            this.connect('destroy', () => this._destroy());
            this.connect("notify::position", () => this._handlePosition());
            // external connections
            this._connections = new Map();
            this._connections.set(AppFavorites.getAppFavorites().connect('changed', () => this._rerender()), AppFavorites.getAppFavorites());
            this._connections.set(this._appSystem.connect('app-state-changed', () => this._rerender(true)), this._appSystem);
            this._connections.set(this._appSystem.connect('installed-changed', () => {
                AppFavorites.getAppFavorites().reload();
                this._rerender();
            }), this._appSystem);
            this._connections.set(global.window_manager.connect('switch-workspace', () => this._rerender(true)), global.window_manager);
            this._connections.set(global.display.connect('window-entered-monitor', () => this._rerender()), global.display);
            this._connections.set(global.display.connect('restacked', () => this._rerender()), global.display);
            this._connections.set(Main.layoutManager.connect('startup-complete', () => this._rerender()), Main.layoutManager);
        }

        _addToPanel() {
            switch (this._config.panelPosition) {

                case 'left':
                    Main.panel._leftBox.insert_child_at_index(this, this._config.panelIndex);
                    break;

                case 'center':
                    Main.panel._centerBox.insert_child_at_index(this, this._config.panelIndex);
                    break;

            }
        }

        _render() {

            const taskbarAppsById = this._getTaskbarApps();

            // validate existing items in the taskbar

            let taskbarAppButtonsByAppId = new Map();
            const layoutActors = this._layout.get_children();

            for (let i = 0, l = layoutActors.length; i < l; ++i) {

                let actor = layoutActors[i];
                const appId = actor instanceof AppButton ? actor.appId : null;

                // remove unnecessary items from the taskbar
                if (!appId || !taskbarAppsById.has(appId)) {
                    actor.destroy();
                    actor = null;
                    continue;
                }

                // the app button should stay in the taskbar
                taskbarAppButtonsByAppId.set(actor.appId, {
                    appButton: actor,
                    position: taskbarAppButtonsByAppId.size
                });
            }

            // update/create app buttons

            const taskbarAppIds = [...taskbarAppsById.keys()];

            for (let i = 0, l = taskbarAppIds.length; i < l; ++i) {
                
                const appId = taskbarAppIds[i];
                const {app, isFavorite, isRestored} = taskbarAppsById.get(appId);

                // create new app buttons
                if (!taskbarAppButtonsByAppId.size || !taskbarAppButtonsByAppId.has(appId)) {
                    const enableAnimation = !this._isRendered || !isRestored;
                    // disable animation for restored app buttons
                    new AppButton(app, isFavorite, this._settings).setParent(this._layout, i, enableAnimation);
                    continue;
                }

                // for existing app buttons check if position has changed
                const {appButton, position} = taskbarAppButtonsByAppId.get(appId);

                // update favorite status
                appButton.isFavorite = isFavorite;
                
                // if position has changed move the app button
                if (position !== i) {
                    appButton.setPosition(i);
                }

                appButton.rerender();
            }

            this._layout.queue_relayout();

            this._isRendered = true;
        }

        _getTaskbarApps() {

            const workspaceIndex = global.workspace_manager.get_active_workspace_index();

            const favoriteApps = this._getFavoriteApps();

            // get running apps

            let runningApps = this._getRunningAppsForWorkspace(workspaceIndex, favoriteApps);
            let oldRunningAppIds = this._restoreRunningAppsForWorkspace(workspaceIndex);

            // no running apps so clear cache for the workspace and exit
            if (!runningApps.size) {
                this._runningAppsByWorkspace[workspaceIndex] = [];
                return favoriteApps;
            }

            // restore position of the running apps for the current workspace
            // if no running apps in cache at this moment then skip

            if (oldRunningAppIds.length) {

                let newRunningApps = new Map();

                for (let i = 0, l = oldRunningAppIds.length; i < l; ++i) {

                    const oldRunningAppId = oldRunningAppIds[i];

                    if (!runningApps.has(oldRunningAppId)) {
                        continue;
                    }

                    let newRunningApp = runningApps.get(oldRunningAppId);

                    // mark restored apps with the flag
                    newRunningApp.isRestored = true;

                    newRunningApps.set(oldRunningAppId, newRunningApp);

                    runningApps.delete(oldRunningAppId);
                }

                if (runningApps.size) {
                    // merge running apps together
                    runningApps = new Map([...newRunningApps, ...runningApps]); 
                } else {
                    runningApps = newRunningApps;
                }

            }

            // update cache for the workspace
            this._runningAppsByWorkspace[workspaceIndex] = [...runningApps.keys()];

            // merge all apps to a single result if it makes sense
            if (favoriteApps.size) {
                return new Map([...favoriteApps, ...runningApps]);
            }

            return runningApps;
        }

        _getFavoriteApps() {
            let result = new Map();

            if (this._config.showFavorites) {

                const favoriteApps = AppFavorites.getAppFavorites().getFavorites();

                for (let i = 0, l = favoriteApps.length; i < l; ++i) {

                    const app = favoriteApps[i];

                    if (!app.id) {
                        continue;
                    }

                    result.set(app.id, {
                        app: app,
                        isFavorite: true
                    });
                }
            }

            return result;
        }

        /**
         * appSystem.get_running() is slow to update
         * using implementation from Dash to Panel instead
        */
        _getRunningAppsForWorkspace(workspaceIndex, favoriteApps = new Map()) {

            let result = new Map();

            const tracker = Shell.WindowTracker.get_default();
            const windows = global.get_window_actors();            

            for (let i = 0, l = windows.length; i < l; ++i) {

                const window = windows[i].metaWindow;

                // get windows from the current workspace only
                // skip windows that skip taskbar
                if (window.get_workspace().index() !== workspaceIndex ||
                        window.skipTaskbar) {
                    continue;
                }

                const app = tracker.get_window_app(window);
                const appId = app ? app.id : null;

                if (!appId || result.has(appId) || favoriteApps.has(appId)) {
                    continue;
                }

                result.set(appId, {
                    app: app,
                    isFavorite: false
                });
            }

            return result;
        }

        _handlePosition() {
            const layoutActors = this._layout.get_children();

            for (let i = 0, l = layoutActors.length; i < l; ++i) {

                let actor = layoutActors[i];

                if (actor instanceof AppButton) {
                    actor.handlePosition();
                }
            }
        }

        _rerender(highPriority) {
            
            this._stopRerender();

            if (!this._workId) {
                return;
            }

            if (highPriority) {
                Main.queueDeferredWork(this._workId);
                return;
            }

            // delay to reduce number of rerenders
            this._rerenderTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {

                if (this._workId) {
                    Main.queueDeferredWork(this._workId);
                }
                
                this._rerenderTimeout = null;
                return GLib.SOURCE_REMOVE;
            });
        }

        _destroy() {
            
            // clear init timeout
            if (this._initTimeout) {
                GLib.source_remove(this._initTimeout);
            }

            // stop rendering
            this._workId = null;
            this._stopRerender();

            // remove some values that may cause exceptions
            this._activeAppButton = null;

            // stop other timers
            this._stopScrollToActiveButton();

            // remove connections
            this._connections.forEach((connection, id) => {
                connection.disconnect(id);
                id = null;
            });
            this._connections = null;

            // destroy layout
            this._layout.get_children().forEach(item => item.destroy());

            // restore default app button in the panel
            if (!Main.overview.visible && !Main.sessionMode.isLocked) {
                Main.panel.statusArea.appMenu.container.show();
            }
        }

        _stopRerender() {
            // clear rerender timeout if any
            if (this._rerenderTimeout) {
                GLib.source_remove(this._rerenderTimeout);
                this._rerenderTimeout = null;
            }
        }

        _setActiveAppButton(appButton) {
            this._activeAppButton = appButton;

            if (!this._activeAppButton) {
                this._stopScrollToActiveButton();
            }
        }

        _handleAppButtonPosition(appButton) {

            if (!appButton || !appButton.appId) {
                return;
            }

            let newAppIds = [];

            // update positions of appButtons in the taskbar

            const layoutActors = this._layout.get_children();

            for (let i = 0, l = layoutActors.length; i < l; ++i) {

                let actor = layoutActors[i];
                const appId = actor instanceof AppButton ? actor.appId : null;

                if (!appId) {
                    continue;
                }

                if (actor.isFavorite === appButton.isFavorite) {
                    newAppIds.push(appId);
                }
            }

            // update workspace cache for running apps

            if (!appButton.isFavorite) {

                const workspaceIndex = global.workspace_manager.get_active_workspace_index();

                // call it just to make sure that we have workspace cache
                this._restoreRunningAppsForWorkspace(workspaceIndex);

                this._runningAppsByWorkspace[workspaceIndex] = newAppIds;

                return;
            }

            // update favorites
            
            const newPosition = newAppIds.indexOf(appButton.appId);

            AppFavorites.getAppFavorites().moveFavoriteToPos(appButton.appId, newPosition);
        }

        _restoreRunningAppsForWorkspace(workspaceIndex) {
            
            const workspacesLength = global.workspace_manager.get_n_workspaces();

            if (!this._runningAppsByWorkspace) {
                this._runningAppsByWorkspace = [];
            }

            // remove obsolete workspaces if any
            if (this._runningAppsByWorkspace.length > workspacesLength) {
                this._runningAppsByWorkspace.splice(workspacesLength - 1, this._runningAppsByWorkspace.length - workspacesLength);
            }

            // no cache for the workspace index so create it
            if (this._runningAppsByWorkspace.length <= workspaceIndex) {
                this._runningAppsByWorkspace.push([]);
            }

            return this._runningAppsByWorkspace[workspaceIndex];
        }

        //#region scroll view tweaks

        _setScrollLock(appButton, locked) {

            if (locked && appButton) {

                this._scrollLock = appButton;

                this._scrollToAppButton(appButton);

                return;
            }

            if (this._scrollLock === appButton) {

                this._scrollLock = null;

                this._scrollToActiveAppButton();
            }
        }

        _scrollToActiveAppButton() {

            this._stopScrollToActiveButton();

            if (!this._activeAppButton) {
                return;
            }

            this._scrollToActiveTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._scrollToAppButton(this._activeAppButton);
                return GLib.SOURCE_REMOVE;
            });
        }

        /**
         * Adapted from GNOME Shell. Modified to work with a horizontal scrollView
         */
        _scrollToAppButton(appButton) {

            if (this.get_stage() === null || !appButton) {
                return;
            }

            if (this._isScrollLockedForAppButton(appButton)) {
                return;
            }

            this._stopScrollToActiveButton();

            const adjustment = this.hscroll.adjustment;

            let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

            let offset = 0;
            const hfade = this.get_effect("fade");
            
            if (hfade) {
                offset = hfade.fade_margins.left;
            }

            let box = appButton.get_allocation_box();
            let x1 = box.x1;
            let x2 = box.x2;

            box = this._layout.get_allocation_box();
            x1 += box.x1;
            x2 += box.x1;

            if (x1 < value + offset) {
                value = Math.max(0, x1 - offset);
            } else if (x2 > value + pageSize - offset) {
                value = Math.min(upper, x2 + offset - pageSize);
            } else return;

            adjustment.ease(value, {
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                duration: 100
            });
        }

        _isScrollLockedForAppButton(appButton) {
            return this._scrollLock && this._scrollLock !== appButton;
        }

        _stopScrollToActiveButton() {
            if (this._scrollToActiveTimeout) {
                GLib.source_remove(this._scrollToActiveTimeout);
                this._scrollToActiveTimeout = null;
            }
        }

        //#endregion scroll view tweaks

        //#endregion private methods

    }
);