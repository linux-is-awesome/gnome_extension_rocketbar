//#region imports

const { Clutter, GLib, GObject, Meta, Shell, St } = imports.gi;
const AppFavorites = imports.ui.appFavorites;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { DominantColorExtractor } = Me.imports.modules.dominantColorExtractor;
const { AppButtonIndicator } = Me.imports.modules.appButtonIndicator;
const { AppButtonMenu } = Me.imports.modules.appButtonMenu;
const { AppButtonTooltip } = Me.imports.modules.appButtonTooltip;
const { NotificationHandler } = Me.imports.modules.notificationService;

//#endregion imports

var AppButton = GObject.registerClass(
    class AppButton extends St.Button {

        //#region public methods

        setParent(parent, position, animation) {

            if (!parent) {
                return;
            }

            this.opacity = 0;

            parent.insert_child_at_index(this, position);

            this.rerender();

            if (!animation) {
                this.opacity = 255;
                return;
            }

            this.ease({
                opacity: 255,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }

        setPosition(position) {

            const parent = this.get_parent();

            if (!parent) {
                return;
            }

            this.remove_all_transitions();

            parent.set_child_at_index(this, position);
        }

        rerender() {
            // call the function only once to avoid multiple loops 
            const windows = this._getAppWindows();

            this._handleAppState(windows);
            this.handlePosition(windows);
        }

        handlePosition() {
            this._updateIconGeometry();
        }

        getDragActor() {
            return this._createAppIconTexture(1.5);
        }

        getDragActorSource() {
            return this;
        }

        //#endregion public methods

        //#region private methods

        _init(app, isFavorite, settings) {

            // init the button
            super._init({
                name: 'taskbar-appButton',
                reactive: true,
                can_focus: true,
                track_hover: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE
            });

            // set public properties
            this.app = app;
            this.appId = app.id;
            this.isFavorite = isFavorite;
            this.activeWindow = null;
            this.notifications = 0;
            this.windows = 0;

            // set private properties
            this._settings = settings;
            this._isActive = false;
            this._isAppRunning = false; //TODO: use in a scroll action
            this._delegate = this;
            this._dominantColor = null;

            // add notifications for the button
            this._notificationHandler = new NotificationHandler(count => this._setNotifications(count), this.appId);

            // idenitify initial configuration
            this._setConfig();

            // create layout
            this._createLayout();
            this._updateIcon();
            this._updateStyle();

            // create connections
            this._createConnections();
        }

        _setConfig() {
            this._config = {
                iconSize: 20, // 16 - 64 pixels
                padding: 8, // 0 - 50 pixels
                verticalMargin: 2, // 0 - 10 pixels
                roundness: 100, // 0 - 100 pixels
                spacing: 0, // 0 - 10 pixels
                backlight: true,
                backlightIntensity: 2, // 1 - 9
                enableTooltips: true
            };
        }

        _createLayout() {

            this._appIcon = new St.Bin({
                name: 'taskbar-appButton-icon',
                y_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.FILL,
                style_class: 'panel-button'
            });

            this.bind_property('hover', this._appIcon, 'hover', GObject.BindingFlags.SYNC_CREATE);

            this._layout = new Clutter.Actor({
                name: 'taskbar-appButton-layout',
                layout_manager: new Clutter.BinLayout(),
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

            this._layout.add_actor(this._appIcon);

            this.set_child(this._layout);

            this._indicator = new AppButtonIndicator(this._layout, this._settings);
        }

        _createConnections() {
            // internal connections
            this.connect('clicked', () => this._activate());
            this.connect('destroy', () => this._destroy());
            this.connect('key-focus-in', () => this._focus(true));
            this.connect('key-focus-out', () => this._focus(false));
            this.connect('notify::hover', () => this._hover());
            // enable drag & drop
            this._draggable = DND.makeDraggable(this, { timeoutThreshold: 200 });
            this._draggable.connect('drag-begin', () => this._dragBegin());
            this._draggable.connect('drag-end', () => this._dragEnd());
            // external connections
            this._connections = new Map();
            this._connections.set(global.display.connect('notify::focus-window', () => this._handleAppState()), global.display);
            this._connections.set(global.display.connect('window-demands-attention', (display, window) => this._handleUrgentWindow(window)), global.display);
            this._connections.set(St.Settings.get().connect('notify::gtk-icon-theme', () => this._updateIcon()), St.Settings.get());
        }

        _destroy() {

            this.remove_all_transitions();

            // remove connections
            this._connections.forEach((connection, id) => {
                connection.disconnect(id);
                id = null;
            });

            this._connections = null;

            // remove app information
            this.app = null;
            this.appId = null;

            // destroy context menu
            this._menu?.close(false);
            this._menu = null;
            this._contextMenuManager = null;

            // destroy indicator
            this._indicator?.destroy();
            this._indicator = null;

            // destroy tooltip if exists
            this._tooltip?.destroy();
            this._tooltip = null;

            // destroy drag & drop functionality
            this._draggable = null;
            this._dragEnd();

            // destroy notification handler
            this._notificationHandler?.destroy();
            this._notificationHandler = null;
        }

        //#region drag & drop

        _dragBegin() {

            this.remove_all_transitions();

            this._dragMonitor = {
                dragMotion: event => this._dragMotion(event)
            };

            DND.addDragMonitor(this._dragMonitor);

            Main.overview.beginItemDrag(this);
        }

        _dragMotion(event) {

            const parent = this.get_parent();

            const [x, y] = parent.get_transformed_position();

            const dragPosition = event.x - x;

            let dragIndex = Math.round(dragPosition / this.width);

            dragIndex = Math.min(Math.max(dragIndex, 0), parent.get_n_children() - 1);

            // makes dragging less aggressive
            if (dragPosition < dragIndex * this.width) {
                return DND.DragMotionResult.CONTINUE;
            }

            const actorAtIndex = parent.get_child_at_index(dragIndex);

            // works only for app buttons
            if (!(actorAtIndex instanceof AppButton) || actorAtIndex === this) {
                return DND.DragMotionResult.CONTINUE;
            }

            // don't allow to drop favorites over running apps and vice versa
            if (this.isFavorite !== actorAtIndex.isFavorite) {
                return DND.DragMotionResult.CONTINUE;
            }

            // drop the app button at the new index
            this.remove_all_transitions();

            this.opacity = 150;

            parent.set_child_at_index(this, dragIndex);

            this._scrollToAppButton();

            this.ease({
                opacity: 150,
                duration: 1000,
                onComplete: () => this.ease({
                    opacity: 255,
                    duration: 300,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                })
            });

            return DND.DragMotionResult.CONTINUE;
        }

        _dragEnd() {

            if (!this._dragMonitor) {
                return;
            }

            this.remove_all_transitions();

            this.opacity = 255;

            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;

            Main.overview.endItemDrag(this);

            // handle destroy of the app button
            if (!this._draggable) {
                return;
            }

            this.get_parent()?.handleAppButtonPosition(this);

            this._updateIconGeometry();
        }

        //#endregion drag & drop

        _activate() {

            const event = Clutter.get_current_event();

            if (!event) {
                return;
            }

            // hide the tooltip if any
            this._toggleTooltip(false);

            // handle secondary button clicks to show the context menu
            if (event.type() === Clutter.EventType.BUTTON_RELEASE &&
                    event.get_button() === Clutter.BUTTON_SECONDARY) {
                this._openMenu();
                return;
            }

            const isOverview = Main.overview._shown;
            const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
            const isMiddleButton = (
                event.type() === Clutter.EventType.BUTTON_RELEASE &&
                event.get_button() === Clutter.BUTTON_MIDDLE
            );
            const openNewWindow = (
                this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || isMiddleButton)
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

        _openMenu() {

            if (!this._menu) {

                this._menu = new AppButtonMenu(this._layout, this.app);

                this._connections.set(this._menu.connect('open-state-changed', () => this._focus()), this._menu);

                this._contextMenuManager = new PopupMenu.PopupMenuManager(this);
                this._contextMenuManager.addMenu(this._menu);
            }

            this._menu.open(true);
            this._contextMenuManager.ignoreRelease();
        }

        _handleAppState(windows) {

            if (this.get_stage() === null) {
                return;
            }

            if (!windows) {
                // this code must be executed right here before validating the app state
                windows = this._getAppWindows();
            }

            // self destroy :)
            if (!this.isFavorite && !windows.length) {
                this.destroy();
                return;
            }

            // store current active window 
            this.activeWindow = windows[0];
            // store current windows count
            this.windows = windows.length;

            // refresh tooltip
            this._tooltip?.refresh();

            // update running state
            this._isAppRunning = windows.length > 0;

            // update active state
            if (this._isActive !== this._hasFocusedWindow) {

                this._isActive = this._hasFocusedWindow;

                this._updateStyle();
            }

            this._indicator?.update(windows, this._isActive);

            if (this._isActive) {
                this.get_parent()?.setActiveAppButton(this);
                this._scrollToAppButton();
            }
        }

        _updateIcon() {
            this._appIcon.set_child(this._createAppIconTexture());

            this._updateDominantColor();
        }

        _updateDominantColor() {

            if (!this._config.backlight) {
                return;
            }

            this._dominantColor = new DominantColorExtractor(this.app).getColor();

            this._handleDominantColorChange();
        }

        _handleDominantColorChange() {
            this._indicator?.setDominantColor(this._dominantColor);
            this._updateStyle();
        }

        _createAppIconTexture(scale) {
            return this.app.create_icon_texture(this._config.iconSize * (scale || 1))
        }

        _updateStyle() {

            this.style = `margin-right: ${this._config.spacing}px;`;

            this._appIcon.style = (
                `padding: 0 ${this._config.padding}px;` +
                `margin: ${this._config.verticalMargin}px 0;` +
                `border-radius: ${this._config.roundness}px;` +
                // currently I have no idea how to completely remove the border
                // when border is 0 panel-button highlight doesn't work for some reason
                `border-width: 1px;`
            );

            if (this._isActive) {

                this._appIcon.add_style_pseudo_class('active');

                this._applyDominantColor();

                return;
            }

            this._appIcon.remove_style_pseudo_class('active');
        }

        _applyDominantColor() {
            
            if (!this._dominantColor) {
                return;
            }

            if (!this._appIcon.style) {
                this._appIcon.style = '';
            }

            this._appIcon.style += 'background-gradient-direction: vertical;';

            const startIntensity = this._config.backlightIntensity - 1;

            this._appIcon.style += (`background-gradient-start: rgba(
                ${this._dominantColor.r},
                ${this._dominantColor.g},
                ${this._dominantColor.b},
                ${startIntensity >= 0 ? '0.' + startIntensity : 0}
            );`);

            this._appIcon.style += (`background-gradient-end: rgba(
                ${this._dominantColor.r},
                ${this._dominantColor.g},
                ${this._dominantColor.b},
                ${'0.' + this._config.backlightIntensity}
            );`);
        }

        /**
        * Update target for minimization animation
        * Credit: Dash to Dock
        * https://github.com/micheleg/dash-to-dock/blob/master/appIcons.js
        */
        _updateIconGeometry(windows) {

            // check if the app button is still present at all. When switching workpaces, the
            // button might have been destroyed in between.
            if (this.get_stage() === null) {
                return;
            }

            if (!windows) {
                windows = this._getAppWindows();
            }

            if (!windows.length) {
                return;
            }

            let rect = new Meta.Rectangle();

            [rect.x, rect.y] = this.get_transformed_position();
            [rect.width, rect.height] = this.get_transformed_size();

            for (let i = 0, l = windows.length; i < l; ++i) {
                windows[i].set_icon_geometry(rect);
            }
        }

        _getAppWindows() {

            this._hasFocusedWindow = false;

            // no windows for a stopped app
            if (this.app.state == Shell.AppState.STOPPED) {
                return [];
            }

            const workspaceIndex = global.workspace_manager.get_active_workspace_index();

            return this.app.get_windows().filter(window => {
                const result = window.get_workspace().index() === workspaceIndex && !window.is_skip_taskbar();

                if (result && window.has_focus()) {
                    // just a trick to avoid multiple loops
                    // one to find windows and another one to find focused windows
                    this._hasFocusedWindow = true;
                }

                return result;
            });
        }

        _handleUrgentWindow(window) {

            // make only active apps handle urgent windows
            if (!window || !this._isActive || window.has_focus()) {
                return;
            }

            const tracker = Shell.WindowTracker.get_default();
            const windowApp = tracker.get_window_app(window);

            if (!windowApp || windowApp.id !== this.appId) {
                return;
            }

            // set focus on urgent windows of this app
            Main.activateWindow(window);
        }

        _focus(isFocused = false) {

            if (this._menu?.isOpen) {
                isFocused = true;
            }

            // show tooltip when focused and menu is not open
            this._toggleTooltip(isFocused && !this._menu?.isOpen);

            if (isFocused) {
                
                this._appIcon.add_style_pseudo_class('focus');
                
                this.get_parent()?.setActiveAppButton(null);
                
                this._scrollToAppButton();

                return;
            }

            this._appIcon.remove_style_pseudo_class('focus');
        }

        _hover() {

            // lock taskbar scroll while hovering the app button 
            this.get_parent()?.setScrollLock(this, this.hover);

            this._toggleTooltip(this.hover);
        }

        _toggleTooltip(show) {

            if (!this._config.enableTooltips) {
                return;
            }

            if (show) {

                if (this._tooltip) {
                    return;
                }

                this._tooltip = new AppButtonTooltip(this);
                return;
            }

            this._tooltip?.destroy(true);
            this._tooltip = null;
        }

        _scrollToAppButton() {

            if (this._menu?.isOpen) {
                return;
            }

            const parent = this.get_parent();

            if (!parent) {
                return;
            }

            parent.scrollToAppButton(this);
        }

        _setNotifications(count) {

            if (this.notifications === count) {
                return;
            }

            this.notifications = count;

            this._indicator?.setNotifications(count);

            this._tooltip?.refresh();
        }

        //#endregion private methods
    }
);