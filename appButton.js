//#region imports

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

//#endregion imports

var AppButton = GObject.registerClass(
    class AppButton extends St.Button {

        rerender() {

        }

        handlePosition() {

        }

        _init(app, isFavorite, settings, eventHandler) {

            // init the button
            super._init({
                reactive: true,
                can_focus: true,
                track_hover: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO
            });

            // set public properties
            this.app = app;
            this.isFavorite = isFavorite;

            // set private properties
            this._settings = settings;
            this._eventHandler = eventHandler;

            this._setConfig();

            this._createLayout();

            this._createConnections();

            this._updateIcon();

            this._updateStyle();
        }

        _setConfig() {
            this._config = {
                iconSize: 20,
                padding: 8
            };
        }

        _createLayout() {

            this._appIcon = new St.Bin({
                reactive: true,
                can_focus: true,
                track_hover: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

            this.bind_property('hover', this._appIcon, 'hover', GObject.BindingFlags.SYNC_CREATE);

            const container = new St.BoxLayout({
                vertical: true,
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            container.add_child(this._appIcon);

            const layout = new Clutter.Actor({
                layout_manager: new Clutter.BinLayout(),
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL,
            });

            layout.add_actor(container);

            this.set_child(layout);
        }

        _createConnections() {
            // internal connections
            this.connect('clicked', (target, button) => this._click(button));
            this.connect('destroy', () => this._destroy());
            // external connections
            this._connections = new Map();
        }

        _updateStyle() {
            this._appIcon.style = (
                `padding: 0 ${this._config.padding}px;`
            );
        }

        _updateIcon() {
            this._appIcon.set_child(this.app.create_icon_texture(this._config.iconSize));
        }

        _click(button) {
            this._activate(button);
        }

        _activate(button) {
            const event = Clutter.get_current_event();
            const modifiers = event ? event.get_state() : 0;
            const isMiddleButton = button && button === Clutter.BUTTON_MIDDLE;
            const isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
            const openNewWindow = (
                this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || isMiddleButton)
            );

            // hide gnome overview
            Main.overview.hide();

            // app is running and we want to open a new window for it
            if (openNewWindow) {
                this.app.open_new_window(-1);
                return;
            }

            const windows = this._getAppWindows();

            // no app windows on the current workspace
            // open a new window for the app
            if (!windows.length) {

                // a favorited app is running, but no windows on current workspace
                // open a new window for the app
                if (this.app.state === Shell.AppState.RUNNING) {
                    this.app.open_new_window(-1);
                    return;
                }

                // app is not running
                // so run the app
                this.app.activate();
                return;
            }

            // activate a single window
            if (windows.length === 1) {
                
                const window = windows[0];
                
                if (window.minimized || !window.has_focus()) {
                    Main.activateWindow(window);
                    return;
                }

                // minimize the window if it's active and has focus
                window.minimize();
                return;

            }

            this._cycleAppWindows(windows);
        }

        _getAppWindows() {
            const workspaceIndex = global.workspace_manager.get_active_workspace_index();

            return this.app.get_windows().filter(window => {
                return window.get_workspace().index() === workspaceIndex && !window.skipTaskbar;
            });
        }

        _cycleAppWindows(windows, reverse) {

            if (!windows || !windows.length) {
                return;
            }

            const lastFocusedWindow = windows[0];  

            windows = windows.sort((a, b) => {
                return a.get_stable_sequence() > b.get_stable_sequence();
            });

            const windowIndex = windows.indexOf(global.display.focus_window);

            let nextWindowIndex = (
                windowIndex < 0 ?
                windows.indexOf(lastFocusedWindow) :
                windowIndex + (reverse ? -1 : 1)
            );

            if (nextWindowIndex === windows.length) {
                nextWindowIndex = 0;
            } else if (nextWindowIndex < 0) {
                nextWindowIndex = windows.length - 1;
            }

            if (windowIndex != nextWindowIndex) {
                Main.activateWindow(windows[nextWindowIndex]);
            }
        }

        _destroy() {

            // remove connections
            this._connections.forEach((connection, id) => {
                connection.disconnect(id);
                id = null;
            });
            this._connections = null;

        }
    }
);