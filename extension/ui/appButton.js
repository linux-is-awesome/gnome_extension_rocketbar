//#region imports

const { Clutter, GLib, GObject, Meta, Shell, St } = imports.gi;
const { PopupMenuManager } = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const IconGrid = imports.ui.iconGrid;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButtonIndicator } = Me.imports.ui.appButtonIndicator;
const { AppButtonMenu } = Me.imports.ui.appButtonMenu;
const { AppButtonTooltip } = Me.imports.ui.appButtonTooltip;
const { DominantColorExtractor } = Me.imports.utils.dominantColorExtractor;
const { NotificationHandler } = Me.imports.utils.notificationService;
const { Connections } = Me.imports.utils.connections;

//#endregion imports

var AppButton = GObject.registerClass(
    class AppButton extends St.Button {

        // appId => {...}
        static CONFIG_OVERRIDE = null;

        //#region public methods

        setParent(parent, position, animation) {

            if (!parent) {
                return;
            }

            // connect parent to handle size and position changes
            this._connections.add(parent, 'queue_relayout', () => this._queueUpdateIconGeometry());

            this.opacity = 0;

            parent.insert_child_at_index(this, position);

            this._handleAppState();

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
            this._handleAppState();
        }

        getDragActor() {
            return this._createAppIconTexture(1.5);
        }

        getDragActorSource() {
            return this;
        }

        getConfigOverride() {
            return {
                iconSize: this._config.iconTextureSize
            };
        }

        setConfigOverride(configOverride) {

            if (!configOverride) {
                return;
            }

            if (!AppButton.CONFIG_OVERRIDE) {
                AppButton.CONFIG_OVERRIDE = {};
            }

            AppButton.CONFIG_OVERRIDE[this.appId] = {
                iconSizeOffset: (
                    configOverride.iconSize ?
                    configOverride.iconSize - this._config.iconSize :
                    0
                )
            };

            // store customizations as a JSON string
            this._settings.set_string('appbutton-config-override', JSON.stringify(AppButton.CONFIG_OVERRIDE));

            // apply changes
            this._handleSettings();
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
            this.isActive = false;
            this.activeWindow = null;
            this.windows = 0;
            this.notifications = 0;
            this.dominantColor = null;

            // set private properties
            this._settings = settings;
            this._delegate = this;
            this._firstUpdateIconGeometry = true;

            // create layout
            this._createLayout();
            this._handleSettings();

            // create connections
            this._createConnections();

            // add notifications for the button
            this._notificationHandler = new NotificationHandler(count => this._setNotifications(count), this.appId);
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
        }

        _createConnections() {
            // internal connections
            this.connect('clicked', () => this._activate());
            this.connect('destroy', () => this._destroy());
            this.connect('key-focus-in', () => this._focus(true));
            this.connect('key-focus-out', () => this._focus(false));
            this.connect('notify::hover', () => this._hover());
            this.connect('scroll-event', (actor, event) => this._handleScroll(event));
            // external connections
            this._connections = new Connections();
            this._connections.add(global.display, 'notify::focus-window', () => this._handleAppState());
            this._connections.add(global.display, 'window-demands-attention', (display, window) => this._handleUrgentWindow(window));
            this._connections.add(St.Settings.get(), 'notify::gtk-icon-theme', () => this._handleIconTheme());
            // handle settings
            this._connections.add(this._settings, 'changed::taskbar-isolate-workspaces', () => this._setConfig());
            this._connections.add(this._settings, 'changed::appbutton-enable-tooltips', () => this._setConfig());
            this._connections.add(this._settings, 'changed::appbutton-enable-scroll', () => this._setConfig());
            this._connections.add(this._settings, 'changed::appbutton-running-app-activate-behavior', () => this._setConfig());
            this._connections.add(this._settings, 'changed::appbutton-enable-indicators', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-enable-notification-badges', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-enable-drag-and-drop', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-icon-size', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-icon-padding', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-vertical-margin', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-spacing', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-roundness', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-backlight', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::appbutton-backlight-intensity', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-dominant-color-active', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-dominant-color-inactive', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-color-active', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-color-inactive', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-position', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-size', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::indicator-display-limit', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::notification-badge-color', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::notification-badge-border-color', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::notification-badge-position', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::notification-badge-size', () => this._handleSettings());
            this._connections.add(this._settings, 'changed::notification-badge-margin', () => this._handleSettings());
        }

        _handleSettings() {
            const oldConfig = this._config || {};

            this._setConfig();

            // set icon size
            if (this._config.iconTextureSize !== oldConfig.iconTextureSize) {
                this._updateIcon();
            }

            // set style
            if (
                this._config.iconSize !== oldConfig.iconSize ||
                this._config.iconPadding !== oldConfig.iconPadding ||
                this._config.verticalMargin !== oldConfig.verticalMargin ||
                this._config.roundness !== oldConfig.roundness ||
                this._config.spacing !== oldConfig.spacing ||
                this._config.backlight !== oldConfig.backlight ||
                this._config.backlightIntensity !== oldConfig.backlightIntensity
            ) {
                this._updateStyle();
            }

            // enable/disable indicators
            if (!this._config.enableIndicators && !this._config.enableNotificationBadges) {
                this._indicator?.destroy();
                this._indicator = null;
            } else if (!this._indicator) {
                this._indicator = new AppButtonIndicator(this, this._layout, this._settings);
            } else {
                this._indicator.updateConfig();
            }

            // enable/disable drag and drop
            if (!this._config.enableDragAndDrop && this._draggablePressHandler) {

                this.disconnect(this._draggablePressHandler);
                this.disconnect(this._draggableTouchHandler);

                this._draggablePressHandler = null;
                this._draggableTouchHandler = null;

            } else if (this._config.enableDragAndDrop && !this._draggablePressHandler) {

                if (!this._draggable) {
                    this._draggable = DND.makeDraggable(this, { manualMode: true, timeoutThreshold: 200 });
                    this._draggable.connect('drag-begin', () => this._dragBegin());
                    this._draggable.connect('drag-end', () => this._dragEnd());
                }

                this._draggablePressHandler = this.connect(
                    'button-press-event',
                    this._draggable._onButtonPress.bind(this._draggable)
                );

                this._draggableTouchHandler = this.connect(
                    'touch-event',
                    this._draggable._onTouchEvent.bind(this._draggable)
                );

            }
        }

        _setConfig() {

            // create config override
            if (!AppButton.CONFIG_OVERRIDE) {

                const configOverride = this._settings.get_string('appbutton-config-override');

                // parse config override
                AppButton.CONFIG_OVERRIDE = (
                    configOverride && configOverride.length ?
                    JSON.parse(configOverride) :
                    {}
                );

                log('AppButton.CONFIG_OVERRIDE init ' + AppButton.CONFIG_OVERRIDE);
            }

            // get override
            const configOverride = AppButton.CONFIG_OVERRIDE[this.appId];

            const iconSize = this._settings.get_int('appbutton-icon-size');

            // calculate icon texture size based on offset from the override
            // result size can be > or < then the icon size
            let iconTextureSize = (
                configOverride && configOverride.iconSizeOffset ?
                iconSize + configOverride.iconSizeOffset :
                iconSize
            );

            // size should not be < 16 and > 64
            iconTextureSize = Math.max(iconTextureSize, 16);
            iconTextureSize = Math.min(iconTextureSize, 64);

            // set config
            this._config = {
                isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces'),
                enableTooltips: this._settings.get_boolean('appbutton-enable-tooltips'),
                enableIndicators: this._settings.get_boolean('appbutton-enable-indicators'),
                enableNotificationBadges: this._settings.get_boolean('appbutton-enable-notification-badges'),
                enableDragAndDrop: this._settings.get_boolean('appbutton-enable-drag-and-drop'),
                enableScrollHandler: this._settings.get_boolean('appbutton-enable-scroll'),
                activateRunningBehavior: this._settings.get_string('appbutton-running-app-activate-behavior'),
                // visual customization settings
                iconSize: iconSize,
                iconTextureSize: iconTextureSize,
                iconPadding: this._settings.get_int('appbutton-icon-padding'),
                verticalMargin: this._settings.get_int('appbutton-vertical-margin'),
                roundness: this._settings.get_int('appbutton-roundness'),
                spacing: this._settings.get_int('appbutton-spacing'),
                backlight: this._settings.get_boolean('appbutton-backlight'),
                backlightIntensity: this._settings.get_int('appbutton-backlight-intensity'),
            };
        }

        _destroy() {

            this.remove_all_transitions();

            if (this._updateIconGeometryTimeout) {
                GLib.source_remove(this._updateIconGeometryTimeout);
                this._updateIconGeometryTimeout = null;
            }

            // remove connections
            this._connections.destroy();

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

            // destroy config override when taskbar is destroying
            if (!this._getTaskbar() && AppButton.CONFIG_OVERRIDE) {
                AppButton.CONFIG_OVERRIDE = null;
            }
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

        /*
         * DND has an issue that prevents me to return other results besides CONTINUE
         * _updateDragHover method creates tons of handleTargetActorDestroyClosure connections
         * and after destroying the button it throws tons of exceptions for no reason
         */
        _dragMotion(event) {

            const isOverview = Main.overview._shown;

            const parent = this.get_parent();

            const [x, y] = parent.get_transformed_position();

            // when in overview mode
            // alow to reorder app buttons only when hovering the taskbar
            if (isOverview && (event.y > (y + parent.height) || event.y < y)) {
                return DND.DragMotionResult.CONTINUE;
            }

            const dragPosition = event.x - x;

            let dragIndex = Math.round(dragPosition / this.width);

            dragIndex = Math.min(Math.max(dragIndex, 0), parent.get_n_children() - 1);

            // makes dragging less aggressive
            if (dragPosition < dragIndex * this.width) {
                return DND.DragMotionResult.CONTINUE;
            }

            const actorAtIndex = parent.get_child_at_index(dragIndex);

            if (actorAtIndex === this) {
                return DND.DragMotionResult.CONTINUE;
            }

            // works only for app buttons
            if (!(actorAtIndex instanceof AppButton)) {
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

            this._getTaskbar()?.handleAppButtonPosition(this);
        }

        //#endregion drag & drop

        _activate() {

            const event = Clutter.get_current_event();

            if (!event) {
                return;
            }

            // hide the tooltip if any
            this._toggleTooltip(false);

            const button = (
                event.type() === Clutter.EventType.BUTTON_RELEASE ?
                event.get_button() :
                null
            );

            // handle secondary button clicks to show the context menu
            if (button === Clutter.BUTTON_SECONDARY) {
                this._openMenu();
                return;
            }

            const isOverview = Main.overview._shown;
            const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
            const isMiddleButton = button === Clutter.BUTTON_MIDDLE;

            // close opened windows
            if (isCtrlPressed && isMiddleButton) {
                this._closeFirstAppWindow();
                return;
            }

            // hide gnome shell overview
            Main.overview.hide();

            const openNewWindow = (
                this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || isMiddleButton)
            );

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

                // when app is not running at all
                if (this.app.state !== Shell.AppState.RUNNING) {
                    this.app.activate();
                    return;
                }

                // a favorited app is running, but no windows on the current workspace
                switch (this._config.activateRunningBehavior) {

                    // move all app windows to the current workspace
                    case 'move_windows':

                        const workspaceIndex = global.workspace_manager.get_active_workspace();
                        
                        this.app.get_windows().forEach(window => {
                            window.change_workspace(workspaceIndex);
                        });

                        // now we have windows on the workpace to activate the first one
                        this._activate();

                        break;

                    // just open a new window
                    default:
                        this.app.open_new_window(-1);

                }

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

        _closeFirstAppWindow() {
            const windows = this._getAppWindows();

            if (!windows.length) {
                return;
            }

            windows[0].delete(global.get_current_time());
        }

        _handleScroll(event) {

            if (!this._config.enableScrollHandler) {
                return Clutter.EVENT_PROPAGATE;
            }

            const scrollDirection = event?.get_scroll_direction();

            // handle only 2 directions: UP and DOWN
            if (scrollDirection !== Clutter.ScrollDirection.UP &&
                    scrollDirection !== Clutter.ScrollDirection.DOWN) {
                return Clutter.EVENT_PROPAGATE;
            }

            // when app is not running
            if (!this.windows || this._handleScrollTimeout) {
                return Clutter.EVENT_STOP;
            }

            // make scrolling less aggressive
            this._handleScrollTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                this._handleScrollTimeout = null;
                return GLib.SOURCE_REMOVE;
            });

            this._cycleAppWindows(this._getAppWindows(), scrollDirection === Clutter.ScrollDirection.UP);

            return Clutter.EVENT_STOP;
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

                this._menu = new AppButtonMenu(this, this._settings);

                this._connections.add(this._menu, 'open-state-changed', () => this._focus());

                this._contextMenuManager = new PopupMenuManager(this);
                this._contextMenuManager.addMenu(this._menu);

            } else {
                this._menu.updateConfig();
            }

            this._menu.open(true);

            this._contextMenuManager.ignoreRelease();
        }

        _handleAppState() {

            if (!this._isValid()) {
                return;
            }

            // this code must be executed right here before validating the app state
            const windows = this._getAppWindows();

            // self destroy :)
            if (!this.isFavorite && !windows.length) {
                this.destroy();
                return;
            }

            const oldWIndows = this.windows;

            // store current active window 
            this.activeWindow = windows.length ? windows[0] : null;
            // store current windows count
            this.windows = windows.length;

            // rerender tooltip
            this._tooltip?.rerender();

            // update active state
            if (this.isActive !== this._hasFocusedWindow) {

                this.isActive = this._hasFocusedWindow;

                this._updateStyle();
            }

            this._indicator?.rerender();

            if (this.isActive) {
                this._getTaskbar()?.setActiveAppButton(this);
                this._scrollToAppButton();
            }

            // the first window has been created for the app
            if (this.windows && !oldWIndows) {
                this._queueUpdateIconGeometry();
            }
        }

        _handleIconTheme() {

            this.dominantColor = null;

            this._updateIcon();
        }

        _updateIcon() {

            this._appIcon.set_child(this._createAppIconTexture());

            this._updateDominantColor();
        }

        _updateDominantColor() {

            if (this.dominantColor) {
                return;
            }

            this.dominantColor = new DominantColorExtractor(this.app).getColor();

            this._updateStyle();

            this._indicator?.updateStyle();
        }

        _createAppIconTexture(scale) {
            return this.app.create_icon_texture(this._config.iconTextureSize * (scale || 1))
        }

        _updateStyle() {

            // add equal spacing on left and right
            const spacing = this._config.spacing / 2;

            this.style = `margin-left: ${spacing}px; margin-right: ${spacing}px;`;

            this._appIcon.style = (
                //set width as sum of icon size and paddings to give extra space for the icon inside
                // we need the space to allow tuning of the icon size for each application
                `width: ${this._config.iconSize + this._config.iconPadding * 2}px;` +
                `height: ${this._config.iconSize}px;` +
                `margin: ${this._config.verticalMargin}px 0;` +
                `border-radius: ${this._config.roundness}px;` +
                // currently I have no idea how to completely remove the border
                // when border is 0 panel-button highlight doesn't work for some reason
                `border-width: 1px;`
            );

            if (this.isActive) {

                this._appIcon.add_style_pseudo_class('active');

                this._applyDominantColor();

                return;
            }

            this._appIcon.remove_style_pseudo_class('active');
        }

        _applyDominantColor() {
            
            if (!this.dominantColor || !this._config.backlight) {
                return;
            }

            if (!this._appIcon.style) {
                this._appIcon.style = '';
            }

            this._appIcon.style += 'background-gradient-direction: vertical;';

            const startIntensity = this._config.backlightIntensity - 1;

            this._appIcon.style += (`background-gradient-start: rgba(
                ${this.dominantColor.r},
                ${this.dominantColor.g},
                ${this.dominantColor.b},
                ${startIntensity >= 0 ? '0.' + startIntensity : 0}
            );`);

            this._appIcon.style += (`background-gradient-end: rgba(
                ${this.dominantColor.r},
                ${this.dominantColor.g},
                ${this.dominantColor.b},
                ${'0.' + this._config.backlightIntensity}
            );`);
        }

        _queueUpdateIconGeometry() {

            if (!this.windows) {
                this._firstUpdateIconGeometry = true;
                return;
            }

            // for the first opened window update icon geometry without a delay
            // with the delay it happens that on double click window could be minimized with wrong icon geometry 
            if (this._isValid() && this._firstUpdateIconGeometry) {
                this._updateIconGeometry();
            }

            if (this._updateIconGeometryTimeout) {
                GLib.source_remove(this._updateIconGeometryTimeout);
            }

            this._updateIconGeometryTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._updateIconGeometryTimeout = null;
                this._updateIconGeometry();
                return GLib.SOURCE_REMOVE;
            });
        }

        /**
        * Update target for minimization animation
        * Credit: Dash to Dock
        * https://github.com/micheleg/dash-to-dock/blob/master/appIcons.js
        */
        _updateIconGeometry() {

            // check if the app button is still present at all. When switching workpaces, the
            // button might have been destroyed in between.
            if (!this._isValid()) {
                return;
            }

            const [width, height] = this.get_transformed_size();

            // button is not allocated at this moment
            if (!height) {
                return;
            }

            const windows = this._getAppWindows();

            if (!windows.length) {
                return;
            }
            
            const rect = new Meta.Rectangle();

            [rect.x, rect.y] = this.get_transformed_position();

            rect.x += width / 2;

            // when buttons on the top
            if (rect.y < 1) {
                rect.y += height;
            }

            for (let i = 0, l = windows.length; i < l; ++i) {
                windows[i].set_icon_geometry(rect);
            }

            this._firstUpdateIconGeometry = false;
        }

        _getAppWindows() {

            let result = [];
    
            this._hasFocusedWindow = false;

            // no windows for a stopped app
            if (this.app.state == Shell.AppState.STOPPED) {
                return result;
            }

            const workspaceIndex = global.workspace_manager.get_active_workspace_index();
            const appWindows = this.app.get_windows();

            for (let i = 0, l = appWindows.length; i < l; ++i) {

                const appWindow = appWindows[i];

                if ((this._config.isolateWorkspaces && appWindow.get_workspace().index() !== workspaceIndex) ||
                        appWindow.skip_taskbar) {
                    continue;
                }

                if (appWindow.has_focus()) {
                    // just a trick to avoid multiple loops
                    // one to find windows and another one to find focused windows
                    this._hasFocusedWindow = true;
                }

                result.push(appWindow);
            }

            return result;
        }

        _handleUrgentWindow(window) {

            // make only active apps handle urgent windows
            if (!window || !this.isActive || window.has_focus()) {
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
                
                this._getTaskbar()?.setActiveAppButton(null);
                
                this._scrollToAppButton();

                return;
            }

            this._appIcon.remove_style_pseudo_class('focus');
        }

        _hover() {

            // lock taskbar scroll while hovering the app button 
            this._getTaskbar()?.setScrollLock(this, this.hover);

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

                this._tooltip = new AppButtonTooltip(this, this._settings);
                return;
            }

            this._tooltip?.destroy(true);
            this._tooltip = null;
        }

        _scrollToAppButton() {

            if (this._menu?.isOpen) {
                return;
            }

            this._getTaskbar()?.scrollToAppButton(this);
        }

        _setNotifications(count) {

            if (this.notifications === count) {
                return;
            }

            this.notifications = count;

            this._indicator?.rerender();

            this._tooltip?.rerender();
        }

        _isValid() {
            return !(!this.mapped || this.get_stage() === null || !this._getTaskbar());
        }

        _getTaskbar() {

            const taskbar = this.get_parent()?.get_parent();

            return taskbar && !taskbar.isDestroying ? taskbar  : null;
        }

        //#endregion private methods
    }
);