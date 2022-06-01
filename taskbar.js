//#region imports

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButton } = Me.imports.appButton;

//#endregion imports

var Taskbar = GObject.registerClass(
    class Taskbar extends St.ScrollView {

        _init(settings) {

            // init scroll view
            super._init({ style_class: 'hfade' });
            this.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.NEVER);
            this.clip_to_allocation = true;

            // hide default app button in the panel
            Main.panel.statusArea.appMenu.container.hide();

            // set properties
            this._appSystem = Shell.AppSystem.get_default();
            this._settings = settings;

            // idenitify initial configuration
            this._setConfig();

            // create layout
            this._createLayout();

            // create connections
            this._createConnections();

            // init deferred work
            this._workId = Main.initializeDeferredWork(this, () => this._render());

            // put the taskbar into the panel
            this._addToPanel();
        }

        _createLayout() {
            this._layout = new St.BoxLayout({
                x_expand: true,
                y_expand: true,
                x_align: Clutter.ActorAlign.FILL,
                y_align: Clutter.ActorAlign.FILL
            })
            this.add_actor(this._layout);
        }

        _createConnections() {
            // internal connections
            this.connect('destroy', () => this._destroy());
            this.connect("notify::position", () => {}); // TODO
            // external connections
            this._connections = new Map();
            this._connections.set(AppFavorites.getAppFavorites().connect('changed', () => this._rerender()), AppFavorites.getAppFavorites());
            this._connections.set(this._appSystem.connect('app-state-changed', () => this._rerender()), this._appSystem);
            this._connections.set(this._appSystem.connect('installed-changed', () => {
                AppFavorites.getAppFavorites().reload();
                this._rerender();
            }), this._appSystem);
            this._connections.set(global.window_manager.connect('switch-workspace', () => this._rerender()), global.window_manager);
            this._connections.set(global.display.connect('window-entered-monitor', () => this._rerender()), global.display);
            this._connections.set(global.display.connect('restacked', () => this._rerender()), global.display);
            this._connections.set(Main.layoutManager.connect('startup-complete', () => this._rerender()), Main.layoutManager);
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

            let taskbarAppsById = new Map();
            let taskbarAppButtonsByAppId = new Map();

            // add favorites if enabled

            if (this._config.showFavorites) {

                const favoriteApps = AppFavorites.getAppFavorites().getFavorites();

                for (let i = 0, l = favoriteApps.length; i < l; ++i) {

                    const app = favoriteApps[i];

                    taskbarAppsById.set(app.get_id(), {
                        app: app,
                        isFavorite: true
                    });
                }
            }

            // add running apps

            const runningApps = this._getRunningApps();

            for (let i = 0, l = runningApps.length; i < l; ++i) {

                const app = runningApps[i];
                const appId = app.get_id();

                if (taskbarAppsById.has(appId)) {
                    continue;
                }

                taskbarAppsById.set(appId, {
                    app: app,
                    isFavorite: false
                });
            }

            // validate existing items in the taskbar

            const layoutActors = this._layout.get_children();

            for (let i = 0, l = layoutActors.length; i < l; ++i) {

                let actor = layoutActors[i];

                // check if the app button should stay in the taskbar
                if (actor instanceof AppButton && actor.app &&
                        taskbarAppsById.has(actor.app.get_id())) {
                    taskbarAppButtonsByAppId.set(actor.app.get_id(), {
                        appButton: actor,
                        position: taskbarAppButtonsByAppId.size
                    });
                    continue;
                }

                // remove unnecessary items from the taskbar
                this._layout.remove_child(actor);
                actor.destroy();
                actor = null;
            }


            // update/create app buttons

            const taskbarAppIds = [...taskbarAppsById.keys()];

            for (let i = 0, l = taskbarAppIds.length; i < l; ++i) {
                
                const appId = taskbarAppIds[i];
                const {app, isFavorite} = taskbarAppsById.get(appId);

                // create new app buttons
                if (!taskbarAppButtonsByAppId.has(appId)) {
                    this._createAppButton(app, isFavorite, i);
                    continue;
                }

                // for existing app buttons check if position has changed
                const {appButton, position} = taskbarAppButtonsByAppId.get(appId);
                
                // position has changed so move the app button
                if (position !== i) {
                    this._layout.remove_child(appButton);
                    this._layout.insert_child_at_index(appButton, i);
                }

            }

            this._layout.queue_relayout();
        }

        /**
         * appSystem.get_running() is slow to update
         * using implementation from Dash to Panel instead
        */
        _getRunningApps() {
            const workspaceIndex = global.workspace_manager.get_active_workspace_index();
            const tracker = Shell.WindowTracker.get_default();
            const windows = global.get_window_actors();
            
            let result = [];

            for (let i = 0, l = windows.length; i < l; ++i) {

                const window = windows[i].metaWindow;
                
                // get windows from the current workspace only
                // skip windows that skip taskbar
                if (window.get_workspace().index() !== workspaceIndex ||
                        window.skipTaskbar) {
                    continue;
                }

                const app = tracker.get_window_app(window);

                if (!app || result.indexOf(app) >= 0) {
                    continue;
                }

                result.push(app);
            }

            return result;
        }

        _createAppButton(app, isFavorite, index) {
            this._layout.insert_child_at_index(new AppButton(
                app, isFavorite,
                this._settings,
                (appButton, event) => {} // TODO: implementation
            ), index);
        }

        _rerender() {
            Main.queueDeferredWork(this._workId);
        }

        _destroy() {
            
            // restore default app button in the panel
            if (!Main.overview.visible && !Main.sessionMode.isLocked) {
                Main.panel.statusArea.appMenu.container.show();
            }

            // remove connections
            this._connections.forEach((connection, id) => {
                connection.disconnect(id);
                id = null;
            });
            this._connections = null;
        }

    }
);