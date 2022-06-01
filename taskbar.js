//#region imports

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

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

            // set required fields
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
            this._layout.queue_relayout();
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