//#region imports

const { Clutter, GLib, GObject, Shell, St, Meta } = imports.gi;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButton } = Me.imports.ui.appButton;
const { Connections } = Me.imports.utils.connections;
const { Favorites } = Me.imports.utils.favorites;

//#endregion imports

var Taskbar = GObject.registerClass(
    class Rocketbar__Taskbar extends St.ScrollView {

        //#region static

        // save ids of running apps in the order they are placed in the taskbar
        // to restore position of the apps after unlocking user's session
        static _runningAppsCache = null; // [appId...]

        //#endregion static

        //#region public methods

        setActiveAppButton(appButton) {
            this._activeAppButton = appButton;

            if (!this._activeAppButton) {
                this._stopScrollToActiveButton();
            }
        }

        handleAppButtonPosition(appButton)  {
            this._handleAppButtonPosition(appButton);
        }

        scrollToAppButton(appButton) {
            this._scrollToAppButton(appButton);
        }

        setScrollLock(appButton, locked) {
            this._setScrollLock(appButton, locked);
        }

        handleDragOver(source) {

            if (!source || !source.app || (source instanceof AppButton)) {
                return DND.DragMotionResult.CONTINUE;
            }

            if (!(source.app instanceof Shell.App)) {
                return DND.DragMotionResult.CONTINUE;
            }

            return DND.DragMotionResult.COPY_DROP;
        }

        acceptDrop(source) {
        
            if (!source || !source.app || !(source.app instanceof Shell.App)) {
                return false;
            }

            if (source instanceof AppButton) {
                return true;
            }

            if (this._favorites) {
                this._favorites.addApp(source.app.id);
            } else {
                source.app.activate();
            }

            return true;
        }

        //#endregion public methods
    
        //#region private methods

        _init(settings) {

            // init scroll view
            super._init({
                name: 'taskbar', 
                style_class: 'hfade',
                reactive: false // allow to handle scroll events on the panel
            });
            this.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.NEVER);
            this.clip_to_allocation = true;

            // hide default app button in the panel
            Main.panel.statusArea.appMenu.container.hide();

            // used by app buttons to stop any kind of updates
            this.isDestroying = false;

            // set private properties
            this._delegate = this;
            this._settings = settings;
            this._isRendered = false; // for the first render execution
            this._currentWorkspace = null;
            this._workId = null;

            // caches
            this._favoriteApps = null;
            this._taskbarApps = null;

            // create layout
            this._createLayout();

            // handle settings
            this._handleSettings();

            // create connections
            this._createConnections();

            // init render
            this._initRender();
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

            this.add_actor(this._layout);
        }

        _createConnections() {
            
            // internal connections
            this.connect('destroy', () => this._destroy());
            this.connect('notify::position', () => this._handlePosition());
            
            // create external connections
            this._connections = new Connections();
            this._connections.add(Main.layoutManager, 'startup-complete', () => this._initRender());

            // prevent default appMenu from displaying on the panel
            this._connections.add(Main.panel.statusArea.appMenu.container, 'notify::visible', appMenu => appMenu.hide());

            // handle settings
            this._connections.add(this._settings, 'changed::taskbar-show-favorites', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::taskbar-isolate-workspaces', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::taskbar-position', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::taskbar-position-offset', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::taskbar-preserve-position', () => this._handleSettings());
        }

        _handleSettings() {
            const oldConfig = this._config || {};

            this._setConfig();

            if (oldConfig.position !== this._config.position ||
                    oldConfig.positionOffset !== this._config.positionOffset ||
                        (this._config.preservePosition && !oldConfig.preservePosition)) {
                this._addToPanel();
            }

            if (this._config.showFavorites && !this._favorites) {
                this._favorites = new Favorites(() => this._rerender('changed'));
            } else if (!this._config.showFavorites && this._favorites)  {
                this._favorites.destroy();
                this._favorites = null;
            }

            if (oldConfig.showFavorites !== this._config.showFavorites ||
                    oldConfig.isolateWorkspaces !== this._config.isolateWorkspaces) {
                this._rerender('changed');
            }
        }

        _setConfig() {
            this._config = {
                showFavorites: this._settings.get_boolean('taskbar-show-favorites'),
                // display running apps from the current workspace only or from all workspaces
                isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces'),
                // position to display the taskbar in the panel
                // left box by default
                position: this._settings.get_string('taskbar-position'),
                // index to display the taskbar in the panel
                // display after Activities button by default
                positionOffset: this._settings.get_int('taskbar-position-offset'),
                preservePosition: this._settings.get_boolean('taskbar-preserve-position')
            };
        }

        _handlePosition() {

            if (!this._config.preservePosition) {
                return;
            }

            const parent = this.mapped ? this.get_parent() : null;

            if (!parent || parent.get_child_at_index(this._config.positionOffset) === this) {
                return;
            }

            this._addToPanel();

            this._rerender();
        }

        _addToPanel() {

            this._stopRerender();

            const parent = this.mapped ? this.get_parent() : null;
            let targetParent = null;

            switch (this._config.position) {
                case 'left':
                    targetParent = Main.panel._leftBox;
                    break;
                case 'center':
                    targetParent = Main.panel._centerBox;
                    break;
                case 'right':
                    targetParent = Main.panel._rightBox;
                    break;
            }

            if (!targetParent) {
                return;
            }

            if (parent && parent === targetParent) {
                if (targetParent.get_n_children() > this._config.positionOffset) {
                    targetParent.set_child_at_index(this, this._config.positionOffset);
                }
                return;
            }

            if (parent) {
                parent.remove_actor(this);
            }

            targetParent.insert_child_at_index(this, this._config.positionOffset);
        }

        //#region taskbar render

        _initRender() {

            // it's not the right time to render the taskbar
            if (Main.layoutManager._startingUp || this._workId) {
                return;
            }

            this._initRenderTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {

                this._initRenderTimeout = null;

                // init rendering work id
                this._workId = Main.initializeDeferredWork(this, () => this._render());

                // connect rendering events
                this._connectWorkspace();
                this._connectRender(Shell.AppSystem.get_default(), 'app-state-changed');
                this._connectRender(global.window_manager, 'switch-workspace');

                return GLib.SOURCE_REMOVE;
            });
        }

        _rerender(event, param) {

            if (!this._workId) {
                this._stopRerender();
                return;
            }

            let highPriority = false;

            // configure rendering based on the handled event
            switch (event) {

                case 'switch-workspace':
                    highPriority = true;
                case 'app-state-changed':
                    // ignore starting apps
                    if (param && param instanceof Shell.App &&
                            param.state === Shell.AppState.STARTING) {
                        return;
                    }
                case 'window_added':
                case 'window_removed':
                    // ignore windows that skip taskbar
                    if (param && param instanceof Meta.Window &&
                            param.skip_taskbar) {
                        return;
                    }
                    // drop taskbar apps cache
                    this._taskbarApps = null;
                    break;

                case 'changed':
                    // drop all caches
                    this._favoriteApps = null;
                    this._taskbarApps = null;
                    break;

            }

            this._stopRerender();

            // check current workspace
            // this should be executed on every render due to shell issues
            this._connectWorkspace();

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

        _connectWorkspace() {
            const currentWorkspace = global.workspace_manager.get_active_workspace();

            if (this._currentWorkspace !== currentWorkspace) {

                this._connections.remove('window_added');
                this._connections.remove('window_removed');

                this._currentWorkspace = currentWorkspace;

                this._connectRender(this._currentWorkspace, 'window_added');
                this._connectRender(this._currentWorkspace, 'window_removed');
            }
        }

        _connectRender(target, event) {
            this._connections.add(target, event, (sender, param) => this._rerender(event, param));
        }

        _render() {

            if (!this._workId) {
                return;
            }

            const taskbarAppsById = (
                // check if we have cache
                this._taskbarApps ?
                // get apps from the cache
                this._taskbarApps :
                // otherwise reload apps
                this._getTaskbarApps()
            );

            // validate existing items in the taskbar

            let taskbarAppButtonsByAppId = new Map();
            let taskbarAppButtonsPosition = [];
    
            const layoutActors = this._layout.get_children();

            for (let i = 0, l = layoutActors.length; i < l; ++i) {

                let actor = layoutActors[i];
                const appId = actor instanceof AppButton ? actor.appId : null;

                // remove unnecessary items from the taskbar
                if (!appId || !taskbarAppsById.has(appId)) {
                    actor.destroy();
                    continue;
                }

                // the app button should stay in the taskbar
                taskbarAppButtonsByAppId.set(actor.appId, actor);

                // save position of the app button
                taskbarAppButtonsPosition.push(actor.appId);
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
                    taskbarAppButtonsPosition.splice(i, 0, appId);
                    continue;
                }

                // for existing app buttons check if position has changed
                const appButton = taskbarAppButtonsByAppId.get(appId);
                const position = taskbarAppButtonsPosition.indexOf(appId);

                // update favorite status
                appButton.isFavorite = isFavorite;
                
                // if position has changed move the app button
                if (position !== i) {
                    appButton.setPosition(i);

                    // replace position in the array
                    taskbarAppButtonsPosition.splice(position, 1);
                    taskbarAppButtonsPosition.splice(i, 0, appId);
                }

                appButton.rerender();
            }

            // notify app buttons that position or size may have changed
            this._layout.queue_relayout();

            this._isRendered = true;

            // update cache
            this._taskbarApps = taskbarAppsById;
        }

        //#endregion taskbar render

        _getTaskbarApps() {

            const workspaceIndex = global.workspace_manager.get_active_workspace_index();

            // get apps to display

            const favoriteApps = this._getFavoriteApps();

            let runningApps = this._getRunningApps(favoriteApps);
            let oldRunningAppIds = this._restoreRunningAppsForWorkspace(workspaceIndex);

            // no running apps so clear cache for the workspace and exit
            if (!runningApps.size) {
                Taskbar._runningAppsCache[workspaceIndex] = [];
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
            Taskbar._runningAppsCache[workspaceIndex] = [...runningApps.keys()];

            // merge all apps to a single result if it makes sense
            if (favoriteApps.size) {
                return new Map([...favoriteApps, ...runningApps]);
            }

            return runningApps;
        }

        _getFavoriteApps() {

            if (!this._config.showFavorites || !this._favorites) {
                this._favoriteApps = null;
                return new Map();
            }

            // return cached data
            if (this._favoriteApps) {
                return this._favoriteApps;
            }

            let result = new Map();

            const favoriteApps = this._favorites.getApps();

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

            // cache the result
            this._favoriteApps = result;

            return result;
        }

        /**
         * appSystem.get_running() is slow to update
         * using implementation from Dash to Panel instead
        */
        _getRunningApps(favoriteApps = new Map()) {

            let result = new Map();

            const tracker = Shell.WindowTracker.get_default();
            const windows = (
                this._config.isolateWorkspaces ?
                // get windows from the current workspace only
                global.workspace_manager.get_active_workspace().list_windows() :
                // get all windows
                global.get_window_actors()
            );            

            for (let i = 0, l = windows.length; i < l; ++i) {

                // workspace_manager.get_active_workspace().list_windows() returns meta windows
                // global.get_window_actors() returns window actors
                const window = windows[i].metaWindow || windows[i];

                // skip windows that skip taskbar
                if (window.skip_taskbar) {
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

        _destroy() {
            
            // clear init render timeout
            if (this._initRenderTimeout) {
                GLib.source_remove(this._initRenderTimeout);
            }

            this.isDestroying = true;

            // stop rendering
            this._workId = null;
            this._stopRerender();

            // destroy favorites
            this._favorites?.destroy();

            // remove connections
            this._connections.destroy();

            // remove some values that may cause exceptions
            this._activeAppButton = null;

            // stop other timers
            this._stopScrollToActiveButton();

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

                Taskbar._runningAppsCache[workspaceIndex] = newAppIds;

                // drop taskbar cache
                this._taskbarApps = null;

                return;
            }

            // update favorites

            if (!this._favorites) {
                return;
            }
            
            const newPosition = newAppIds.indexOf(appButton.appId);

            this._favorites.moveAppToPosition(appButton.appId, newPosition);
        }

        _restoreRunningAppsForWorkspace(workspaceIndex) {
            
            const workspacesLength = global.workspace_manager.get_n_workspaces();

            if (!Taskbar._runningAppsCache) {
                Taskbar._runningAppsCache = [];
            }

            // remove obsolete workspaces if any
            if (Taskbar._runningAppsCache.length > workspacesLength) {
                Taskbar._runningAppsCache.splice(workspacesLength - 1, Taskbar._runningAppsCache.length - workspacesLength);
            }

            // no cache for the workspace index so create it
            if (Taskbar._runningAppsCache.length <= workspaceIndex) {
                while (Taskbar._runningAppsCache.length <= workspaceIndex) {
                    Taskbar._runningAppsCache.push([]);
                }
            }

            return Taskbar._runningAppsCache[workspaceIndex];
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