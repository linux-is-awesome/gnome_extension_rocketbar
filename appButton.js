//#region imports

const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const { AppMenu } = imports.ui.appMenu;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;

//#endregion imports

class AppButtonIndicator {

    constructor(parent, settings) {
        this._parent = parent;
        this._settings = settings;
        this._indicators = null;
        this._activeState = false;

        this._setConfig();
    }

    //#region public methods

    destroy() {
        this._destroyIndicators();
    }

    update(windows) {

        // no need to display indicators
        if (!windows?.length) {
            this._destroyIndicators();
            return;
        }

        // count the maximum number of indicators to display
        let maxIndicators = (
            windows.length > this._config.maxIndicators ?
            this._config.maxIndicators :
            windows.length
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // no need to change indicators
        if (indicatorsLength === maxIndicators) {
            return;
        }

        // check if some idicators should be destroyed
        // this will be executed in case we have more than one indicator
        if (indicatorsLength > maxIndicators) {

            let indicatorsToDestroy = this._indicators.splice(maxIndicators - 1, indicatorsLength - maxIndicators);

            indicatorsToDestroy.forEach(indicator => {
                indicator.destroy();
                indicator = null;
            });

        } else {

            // don't create more than we need to display
            maxIndicators -= indicatorsLength;

            // create new indicators
            for (let i = 0; i < maxIndicators; ++i) {
                this._addIndicator();
            }
        }

        this.rerender();
    }

    rerender() {

        if (!this._indicators?.length) {
            return;
        }

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._indicators[i].style = this._getIndicatorStyle(i);
        }   
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            color: 'white',
            activeColor: 'blue',
            size: 4,
            maxIndicators: 2
        };
    }

    _addIndicator() {

        if (!this._parent) {
            return;
        }

        if (!this._indicators) {
            this._indicators = [];
        }

        const indicatorIndex = this._indicators.length;

        const indicator = new St.Icon({
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            opacity: 0
        });

        this._indicators.push(indicator);

        this._parent.add_actor(indicator);

        indicator.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _getIndicatorStyle(index) {

        let result = (
            `background-color: ${this._config.color};` +
            `width: ${this._config.size}px;` +
            `height: ${this._config.size}px;` +
            `border-radius: ${this._config.size}px;`
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // check if no more indicators exist
        if (indicatorsLength <= 1) {
            return result;
        }

        // add margins when multiple idicators exist

        const margin = this._config.size + (this._config.size / 2);

        if (index === 0 || index < (indicatorsLength - 1)) {
            const marginOffset = indicatorsLength - 1 - index;
            result += `margin-right: ${margin * marginOffset}px;`;
        }

        if (index > 0) {
            result += `margin-left: ${margin * index}px;`;
        }

        return result;
    }

    _destroyIndicators() {

        if (!this._indicators?.length) {
            return;
        }

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._indicators[i].destroy();
            this._indicators[i] = null;
        }

        this._indicators = null;
    }

    //#endregion private methods

}

var AppButton = GObject.registerClass(
    class AppButton extends St.Button {

        //#region public methods

        rerender() {
            this._updateIcon();
            this._handleAppState();
            this.handlePosition();
        }

        handlePosition() {
            this._updateIconGeometry();
        }

        //#endregion public methods

        //#region private methods

        _init(app, isFavorite, settings) {

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

            // idenitify initial configuration
            this._setConfig();

            // create layout
            this._createLayout();
            this._updateIcon();
            this._updateStyle();

            // create connections
            this._createConnections();

            // check if app is running
            this._handleAppState();
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
                y_align: Clutter.ActorAlign.FILL
            });

            container.add_child(this._appIcon);

            const layout = new Clutter.Actor({
                layout_manager: new Clutter.BinLayout(),
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

            layout.add_actor(container);

            this.set_child(layout);

            this._indicator = new AppButtonIndicator(layout, this._settings);
        }

        _updateStyle() {
            this._appIcon.style = (
                `padding: 0 ${this._config.padding}px;`
            );
        }

        _updateIcon() {
            this._appIcon.set_child(this.app.create_icon_texture(this._config.iconSize));
        }

        _createConnections() {
            // internal connections
            this.connect('clicked', () => this._activate());
            this.connect('button_press_event', () => this._handleButtonPress());
            this.connect('destroy', () => this._destroy());
            // external connections
            this._connections = new Map();
            this._connections.set(global.display.connect('notify::focus-window', () => this._handleAppState()), global.display);
        }

        _handleButtonPress() {

            const event = Clutter.get_current_event();

            if (event?.get_button() === Clutter.BUTTON_SECONDARY) {
                this._openMenu();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        }

        _activate() {
            const event = Clutter.get_current_event();

            if (!event) {
                return;
            }

            const isOverview = Main.overview._shown;
            const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
            const openNewWindow = (
                this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || event.get_button() === Clutter.BUTTON_MIDDLE)
            );

            // hide gnome shell overview
            Main.overview.hide();

            // app is running and we want to open a new window for it
            if (openNewWindow) {
                IconGrid.zoomOutActor(this._appIcon);
                this.app.open_new_window(-1);
                return;
            }

            const windows = this._getAppWindows();

            // no app windows on the current workspace
            // open a new window for the app
            if (!windows.length) {

                IconGrid.zoomOutActor(this._appIcon);

                // a favorited app is running, but no windows on the current workspace
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

            // activate/minimize a single window
            // or activate the first window when gnome shell overview is shown
            if (windows.length === 1 || isOverview) {
                
                const window = windows[0];
                
                if (window.minimized || !window.has_focus() || isOverview) {
                    Main.activateWindow(window);
                    return;
                }

                // minimize the window if it's active and has focus
                window.minimize();
                return;

            }

            this._cycleAppWindows(windows);
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
                // when the app has no focused windows
                windowIndex < 0 ?
                // using index of the last focused window
                windows.indexOf(lastFocusedWindow) :
                // otherwise go to the next window of the app
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

        _handleAppState() {

            const windows = this._getAppWindows();

            this._indicator.update(windows);
        }

        /**
        * Update target for minimization animation
        * Credit: Dash to Dock
        * https://github.com/micheleg/dash-to-dock/blob/master/appIcons.js
        */
        _updateIconGeometry() {

            if (this.get_stage() === null) {
                return;
            }

            const windows = this._getAppWindows();

            if (!windows.length) {
                return;
            }

            this.get_allocation_box();
            let rect = new Meta.Rectangle();

            [rect.x, rect.y] = this.get_transformed_position();
            [rect.width, rect.height] = this.get_transformed_size();

            for (let i = 0, l = windows.length; i < l; ++i) {
                windows[i].set_icon_geometry(rect);
            }
        }

        _getAppWindows() {

            // no windows for a stopped app
            if (this.app.state == Shell.AppState.STOPPED) {
                return [];
            }

            const workspaceIndex = global.workspace_manager.get_active_workspace_index();

            return this.app.get_windows().filter(window => {
                return window.get_workspace().index() === workspaceIndex && !window.skipTaskbar;
            });
        }

        _openMenu() {

            if (!this._menu) {

                this._menu = new AppMenu(this, St.Side.TOP, {
                    favoritesSection: true,
                    showSingleWindows: true,
                });

                this._menu.blockSourceEvents = true;
                this._menu.setApp(this.app);

                this._connections.set(this._menu.connect('open-state-changed', (menu, isOpen) => {
                    if (!isOpen) {
                        // TODO: handle menu close
                    }
                }), this._menu);

                Main.uiGroup.add_actor(this._menu.actor);

                this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
                this._contextMenuManager.addMenu(this._menu);
            }

            this._menu.open();
            this._contextMenuManager.ignoreRelease();
        }

        _destroy() {

            // remove connections
            this._connections.forEach((connection, id) => {
                connection.disconnect(id);
                id = null;
            });
            this._connections = null;

            // destroy context menu
            this._menu?.close();
            //this._menu?.destroy();
            this._menu = null;
            this._contextMenuManager = null;

            // destroy indicator
            this._indicator?.destroy();
            this._indicator = null;
        }

        //#endregion private methods
    }
);