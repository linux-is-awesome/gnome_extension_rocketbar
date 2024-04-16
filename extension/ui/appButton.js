/* exported AppButton */

//#region imports

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';

// custom modules import
import { AppButtonIndicator } from './appButtonIndicator.js';
import { AppButtonNotificationBadge } from './appButtonNotificationBadge.js';
import { AppButtonMenu } from './appButtonMenu.js';
import { AppButtonTooltip } from './appButtonTooltip.js';
import { DominantColorExtractor } from '../utils/dominantColorExtractor.js';
import { NotificationHandler } from '../services/notificationService.js';
import { AppSoundVolumeControl } from '../services/soundVolumeService.js';
import { Connections } from '../utils/connections.js';
import { ScrollHandler } from '../utils/scrollHandler.js';
import { Timeout } from '../utils/timeout.js';

//#endregion imports

class AppButtonConfigOverride {

    // appId => {...}
    static _cache = null;

    constructor(appId, settings, callback) {

        this._appId = appId;
        this._settings = settings;
        this._callback = callback;
        this._values = {};

        if (this.constructor._cache) {
            return;
        }

        const configOverride = this._settings.get_string('appbutton-config-override');

        // parse config override
        this.constructor._cache = (
            configOverride && configOverride.length ?
            JSON.parse(configOverride) :
            {}
        );
    }

    destroy() {
        this.constructor._cache = null;
    }

    apply(config) {

        if (!config) {
            return;
        }

        // get override
        const configOverride = this.constructor._cache[this._appId];

        // calculate icon texture size based on offset from the override
        // result size can be > or < then the icon size
        if (configOverride?.iconSizeOffset) {

            let iconTextureSize = config.iconTextureSize + configOverride.iconSizeOffset;

            // size should not be < 16 and > 64
            iconTextureSize = Math.max(iconTextureSize, 16);
            iconTextureSize = Math.min(iconTextureSize, 64);

            config.iconTextureSize = iconTextureSize;
        }

        if (configOverride?.customIconPath) {
            config.customIconPath = configOverride.customIconPath;
        }

        if (configOverride?.activateRunningBehavior) {
            config.activateRunningBehavior = configOverride.activateRunningBehavior;
        }

        this._values = config;
    }

    equals(values) {

        if (!values) {
            return false;
        }

        const initialValues = this.get();

        for (let key in initialValues) {
            if (initialValues[key] !== values[key]) {
                return false;
            }
        }

        return true;
    }

    get() {
        return {
            iconSize: this._values.iconTextureSize,
            activateRunningBehavior: this._values.activateRunningBehavior,
            customIconPath: this._values.customIconPath
        };
    }

    set(values) {

        if (!values) {
            return;
        }

        this.constructor._cache[this._appId] = {
            iconSizeOffset: (
                values.iconSize ?
                values.iconSize - this._values.iconSize :
                0
            ),
            activateRunningBehavior: values.activateRunningBehavior,
            customIconPath: values.customIconPath
        };

        this.save();
    }

    reset() {

        if (this.isEmpty()) {
            return;
        }

        delete this.constructor._cache[this._appId];

        this.save();
    }

    save() {

        this._settings.set_string(
            'appbutton-config-override',
            JSON.stringify(this.constructor._cache)
        );

        if (!this._callback) {
            return;
        }

        this._callback();
    }

    isEmpty() {
        return !this.constructor._cache?.hasOwnProperty(this._appId);
    }

}

export const AppButton = GObject.registerClass(
    class Rocketbar__AppButton extends St.Button {

        //#region static

        // appId => color
        static _dominantColorCache = {};

        //#endregion static

        //#region public methods

        constructor({ app, isFavorite }, settings, iconProvider, stateHandler) {

            // init the button
            super({
                name: 'taskbar-appButton',
                reactive: true,
                can_focus: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO | St.ButtonMask.THREE,
                opacity: 0
            });

            // set public properties
            this.app = app;
            this.appId = app?.id;
            this.isFavorite = isFavorite;
            this.isActive = false;
            this.activeWindow = null;
            this.windows = 0;
            this.notifications = 0;
            this.dominantColor = null;
            this.soundVolumeControl = null;
            this.configOverride = new AppButtonConfigOverride(this.appId, settings, () => this._handleSettings());

            // set private properties
            this._settings = settings;
            this._iconProvider = iconProvider;
            this._delegate = this;
            this._firstUpdateIconGeometry = true;
            this._lastFocusedWindow = null;
            this._stateHandler = stateHandler;

            this._createLayout();

            this._handleSettings();

            this._createConnections();

            this._createMenu();

            // init notification handler
            this._notificationHandler = new NotificationHandler(
                count => this._setNotifications(count),
                this._settings, this.appId
            );
        }

        setParent(parent, position, animation) {

            if (!parent) {
                return;
            }

            // connect parent events
            this._connections.add(parent, 'queue_relayout', () => this._queueUpdateIconGeometry());
            this._connections.add(parent, 'destroy', () => this._parentDestroy());

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

        handleUrgentWindow(window) {
            this._handleUrgentWindow(window);
        }

        getDragActor() {
            return this._createAppIconTexture(1.5);
        }

        getDragActorSource() {
            return this;
        }

        //#endregion public methods

        //#region private methods

        _createLayout() {

            this._appIcon = new St.Bin({
                name: 'taskbar-appButton-icon',
                y_expand: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'panel-button rocketbar__button'
            });

            this.bind_property('hover', this._appIcon, 'hover', GObject.BindingFlags.SYNC_CREATE);

            this._layout = new Clutter.Actor({
                name: 'taskbar-appButton-layout',
                layout_manager: new Clutter.BinLayout(),
                y_expand: true,
                y_align: Clutter.ActorAlign.FILL
            });

            this._layout.add_child(this._appIcon);

            this.set_child(this._layout);
        }

        _createMenu() {
            this._createMenuTimeout = Timeout.low(300).run(() => {

                this._menu = new AppButtonMenu(this, this._settings, this._iconProvider);

                this._connections.add(this._menu, 'open-state-changed', () => this._focus());
            });
        }

        _createConnections() {
            // internal connections
            this.connect('clicked', () => this._activate());
            this.connect('destroy', () => this._destroy());
            this.connect('key-focus-in', () => this._focus());
            this.connect('key-focus-out', () => this._focus());
            this.connect('notify::hover', () => this._hover());
            this.connect('button-press-event', () => this._buttonPress());
            this.connect('button-release-event', () => this._buttonRelease());
            // external connections
            this._connections = new Connections();
            this._connections.add(global.display, 'notify::focus-window', () => this._handleFocusedWindow());
            this._connections.add(St.Settings.get(), 'notify::gtk-icon-theme', () => this._handleIconTheme(true));
            // handle settings
            this._connections.addScope(this._settings, [
                'changed::taskbar-isolate-workspaces',
                'changed::appbutton-enable-tooltips',
                'changed::appbutton-enable-minimize-action',
                'changed::appbutton-middle-button-sound-mute',
                'changed::sound-volume-control-change-speed',
                'changed::sound-volume-control-change-speed-ctrl'], () => this._setConfig());
            this._connections.addScope(this._settings, [
                'changed::appbutton-running-app-activate-behavior',
                'changed::appbutton-enable-indicators',
                'changed::appbutton-enable-notification-badges',
                'changed::appbutton-enable-sound-control',
                'changed::appbutton-enable-drag-and-drop',
                'changed::appbutton-enable-scroll',
                'changed::appbutton-scroll-change-sound-volume',
                'changed::appbutton-icon-size',
                'changed::appbutton-icon-padding',
                'changed::appbutton-icon-vertical-padding',
                'changed::appbutton-spacing',
                'changed::appbutton-roundness',
                'changed::appbutton-backlight-color',
                'changed::appbutton-backlight-dominant-color',
                'changed::appbutton-backlight-intensity',
                'changed::notification-badge-color',
                'changed::notification-badge-border-color',
                'changed::notification-badge-position',
                'changed::notification-badge-size',
                'changed::notification-badge-margin'], () => this._handleSettings());
        }

        _handleSettings() {

            const hasOldConfig = this._config ? true : false;
            const oldConfig = this._config || {};

            this._setConfig();

            // set icon
            if (hasOldConfig && this._config.customIconPath !== oldConfig.customIconPath) {
                this._handleIconTheme();
            } else if (this._config.iconTextureSize !== oldConfig.iconTextureSize) {
                this._updateIcon();
            } else {
                this._updateDominantColor();
            }

            // set style
            if ((hasOldConfig || !this.style) && (
                this._config.iconSize !== oldConfig.iconSize ||
                this._config.iconPadding !== oldConfig.iconPadding ||
                this._config.iconVerticalPadding !== oldConfig.iconVerticalPadding ||
                this._config.roundness !== oldConfig.roundness ||
                this._config.spacing !== oldConfig.spacing ||
                this._config.backlightColor !== oldConfig.backlightColor ||
                this._config.backlightDominantColor !== oldConfig.backlightDominantColor ||
                this._config.backlightIntensity !== oldConfig.backlightIntensity
            )) {
                this._updateStyle();
            }

            // enable/disable indicators
            if (!this._config.enableIndicators) {
                this._indicator?.destroy();
                this._indicator = null;
            } else if (!this._indicator) {
                this._indicator = new AppButtonIndicator(this, this._layout, this._settings);
            }

            // enable/disable notification badge
            if (!this._config.enableNotificationBadges) {
                this._notificationBadge?.destroy();
                this._notificationBadge = null;
            } else if (!this._notificationBadge) {
                this._notificationBadge = new AppButtonNotificationBadge(this, this._layout, this._settings);
            } else {
                this._notificationBadge.updateConfig();
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

            // toggle sound volume control
            if (!this._config.enableSoundControl) {
                this.soundVolumeControl?.destroy();
                this.soundVolumeControl = null;
                // force this off
                this._config.scrollToChangeSoundVolume = false;
            } else if (!this.soundVolumeControl) {
                this.soundVolumeControl = new AppSoundVolumeControl(this.app);
            }

            // toggle scroll handler
            if (!this._config.enableScrollHandler && !this._config.scrollToChangeSoundVolume) {
                this._scrollHandler?.destroy();
                this._scrollHandler = null;
            } else if (!this._scrollHandler) {
                this._scrollHandler = new ScrollHandler(this, (params) => this._handleScroll(params))
            }

        }

        _setConfig() {

            this._config = {
                isolateWorkspaces: this._settings.get_boolean('taskbar-isolate-workspaces'),
                enableTooltips: this._settings.get_boolean('appbutton-enable-tooltips'),
                enableIndicators: this._settings.get_boolean('appbutton-enable-indicators'),
                enableNotificationBadges: this._settings.get_boolean('appbutton-enable-notification-badges'),
                enableDragAndDrop: this._settings.get_boolean('appbutton-enable-drag-and-drop'),
                enableScrollHandler: this._settings.get_boolean('appbutton-enable-scroll'),
                enableMinimizeAction: this._settings.get_boolean('appbutton-enable-minimize-action'),
                enableSoundControl: this._settings.get_boolean('appbutton-enable-sound-control'),
                scrollToChangeSoundVolume: this._settings.get_boolean('appbutton-scroll-change-sound-volume'),
                middleButtonToggleMute: this._settings.get_boolean('appbutton-middle-button-sound-mute'),
                activateRunningBehavior: this._settings.get_string('appbutton-running-app-activate-behavior'),
                soundVolumeStep: this._settings.get_int('sound-volume-control-change-speed'),
                soundVolumeStepCtrl: this._settings.get_int('sound-volume-control-change-speed-ctrl'),
                // visual customization settings
                iconSize: this._settings.get_int('appbutton-icon-size'),
                iconTextureSize: this._settings.get_int('appbutton-icon-size'),
                iconPadding: this._settings.get_int('appbutton-icon-padding'),
                iconVerticalPadding: this._settings.get_int('appbutton-icon-vertical-padding'),
                roundness: this._settings.get_int('appbutton-roundness'),
                spacing: this._settings.get_int('appbutton-spacing'),
                backlightColor: this._settings.get_string('appbutton-backlight-color'),
                backlightIntensity: this._settings.get_int('appbutton-backlight-intensity'),
                backlightDominantColor: this._settings.get_boolean('appbutton-backlight-dominant-color'),
                indicatorDominantColor: (
                    this._settings.get_boolean('indicator-dominant-color-inactive') ||
                    this._settings.get_boolean('indicator-dominant-color-active')
                ),
                customIconPath: null
            };

            // parse backlight color
            if (this._config.backlightColor) {
                const colorValues = this._config.backlightColor.replace('rgb(', '')
                                                       .replace('rgba(', '')
                                                       .replace(')', '')
                                                       .split(',');
                this._config.backlightColor = {
                    r: colorValues[0].trim(),
                    g: colorValues[1].trim(),
                    b: colorValues[2].trim()
                }
            }

            this.configOverride.apply(this._config);
        }

        _parentDestroy() {
            // destroy static variables when taskbar is destroying
            this.configOverride?.destroy();
            // avoid triggering the handler
            this._stateHandler = null;
        }

        _destroy() {

            this.remove_all_transitions();

            // notify taskbar about destroying
            this._triggerState('destroy');

            // remove timeouts
            this._stopUpdateIconGeometryQueue();
            this._handleScrollTimeout?.destroy();
            this._createMenuTimeout?.destroy();

            // remove connections
            this._connections.destroy();
            this._connections = null;

            // remove app information
            this.app = null;
            this.appId = null;
            this.configOverride = null;

            // destroy context menu
            this._menu?.destroy();
            this._menu = null;

            // destroy indicator
            this._indicator?.destroy();
            this._indicator = null;

            // destroy notification badge
            this._notificationBadge?.destroy();
            this._notificationBadge = null;


            // destroy tooltip if exists
            this._tooltip?.destroy();
            this._tooltip = null;

            // destroy drag & drop functionality
            this._draggable = null;
            this._dragEnd();

            // destroy notification handler
            this._notificationHandler?.destroy();
            this._notificationHandler = null;

            // destroy sound control
            this.soundVolumeControl?.destroy();
            this.soundVolumeControl = null;

            // destroy scroll handler
            this._scrollHandler?.destroy();
            this._scrollHandler = null;
        }

        //#region drag & drop

        _dragBegin() {

            this._buttonRelease();

            this._dragMonitor = {
                dragMotion: event => this._dragMotion(event)
            };

            DND.addDragMonitor(this._dragMonitor);

            Main.overview.beginItemDrag(this);

            this._triggerState('drag-start');
        }

        /*
         * DND has an issue that prevents me to return other results besides CONTINUE
         * _updateDragHover method creates tons of handleTargetActorDestroyClosure connections
         * and after destroying the button it throws tons of exceptions for no reason
         */
        _dragMotion(event) {

            const isOverview = Main.overview.visible;

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
            parent.set_child_at_index(this, dragIndex);

            this._triggerState('drag-motion');

            return DND.DragMotionResult.CONTINUE;
        }

        _dragEnd() {

            if (!this._dragMonitor) {
                return;
            }

            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;

            Main.overview.endItemDrag(this);

            // handle destroy of the app button
            if (!this._draggable) {
                return;
            }

            this._triggerState('drag-end');
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
                this._menu?.open();
                return;
            }

            const isMiddleButton = button === Clutter.BUTTON_MIDDLE;

            // check if toggle sound mute action is required and possible
            if (isMiddleButton &&
                    this._config.middleButtonToggleMute && this.soundVolumeControl) {
                this.soundVolumeControl.toggleOutputMute();
                return;
            }

            const isOverview = Main.overview.visible;
            const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;

            // hide gnome shell overview
            if (!isCtrlPressed && !isMiddleButton) {
                Main.overview.hide();
            }

            // close opened windows
            if (isCtrlPressed && isMiddleButton) {
                this._closeFirstAppWindow();
                return;
            }

            const openNewWindow = (
                this.app.can_open_new_window() &&
                this.app.state === Shell.AppState.RUNNING &&
                (isCtrlPressed || isMiddleButton)
            );

            // app is running and we want to open a new window for it
            if (openNewWindow) {
                this._openNewAppWindow();
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

                // when a favorited app is running, but no windows on the current workspace

                if (!this._config.isolateWorkspaces ||
                        this._config.activateRunningBehavior !== 'move_windows') {

                    this.app.open_new_window(-1);

                } else {

                    // move all app windows to the current workspace
    
                    const appWindows = this.app.get_windows();

                    // if something goes wrong with the app
                    if (!appWindows?.length) {
                        return;
                    }

                    const workspaceIndex = global.workspace_manager.get_active_workspace();

                    appWindows.forEach(window => {
                        window.change_workspace(workspaceIndex);
                    });

                    // now we have windows on the workpace to activate the first one
                    Main.activateWindow(appWindows[0]);
                }

                return;
            }

            // activate/minimize a single window
            // or activate the first window when gnome shell overview is shown
            if (windows.length === 1 || isOverview) {

                const window = windows[0];
                
                if (window.minimized || !window.has_focus() || isOverview) {

                    Main.activateWindow(window);

                    this._addCycledWindow(window);

                    return;
                }

                // minimize the window if it's active and has focus
                // and when minimize action is not disabled
                if (this._config.enableMinimizeAction) {
                    window.minimize();
                }

                return;

            }

            this._cycleAppWindows(windows);
        }

        _openNewAppWindow() {

            IconGrid.zoomOutActor(this._appIcon);

            this.app.open_new_window(-1);

            this._resetCycledWindows();
        }

        _closeFirstAppWindow() {

            this.activeWindow?.delete(global.get_current_time());

            this._resetCycledWindows();
        }

        _handleScroll(params) {

            const [scrollDirection, isCtrlPressed] = params;

            // change sound volume if it's required and possible
            if (this._config.scrollToChangeSoundVolume && this.soundVolumeControl) {

                const soundVolumeStep = (
                    isCtrlPressed ?
                    this._config.soundVolumeStepCtrl :
                    this._config.soundVolumeStep
                );

                this.soundVolumeControl.addOutputVolume(
                    scrollDirection === Clutter.ScrollDirection.UP ?
                    soundVolumeStep :
                    -soundVolumeStep
                );

                // update tooltip if it's shown
                this._tooltip?.rerender();

                return Clutter.EVENT_STOP;
            }

            // when app is not running
            if (!this.windows || this._handleScrollTimeout) {
                return Clutter.EVENT_STOP;
            }

            // make scrolling less aggressive
            this._handleScrollTimeout = Timeout.default(300).run(() => {
                this._handleScrollTimeout = null;
            });

            if (Main.overview.visible) {
                Main.overview.hide();
            }

            this._resetCycledWindows();

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

            const nextWindow = windows[nextWindowIndex];

            if (windowIndex === nextWindowIndex) {
                return;
            }

            if (this._config.enableMinimizeAction &&
                    !nextWindow.minimized && this._cycledWindows?.has(nextWindow)) {
                
                windows.forEach(window => window.minimize());
                
                this._resetCycledWindows();
                
                return;
            }

            this._addCycledWindow(nextWindow);

            Main.activateWindow(nextWindow);
        }

        _handleFocusedWindow() {

            // avoid unnesessary executions
            if (!this.isActive && !global.display.focus_window) {
                this._lastFocusedWindow = null;
                return;
            }

            if (this._lastFocusedWindow === global.display.focus_window) {
                return;
            }

            this._lastFocusedWindow = global.display.focus_window;

            this._handleAppState();
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
                this._triggerState('active');

                // used after we create a new window or close the first one
                if (this.hover) {
                    this._addCycledWindow(this.activeWindow);
                }
            }

            // the first window has been created for the app
            if (this.windows && !oldWIndows) {

                this._queueUpdateIconGeometry();

                this.soundVolumeControl?.handleAppState();
            }

        }

        _handleIconTheme(resetCache) {

            this.dominantColor = null;

            if (resetCache) {
                AppButton._dominantColorCache = {};
            } else {
                delete AppButton._dominantColorCache[this.appId];
            }

            this._updateIcon();
        }

        _updateIcon() {

            const oldIcon = this._appIcon.get_child();
            
            // make sure that the child is destroyed
            if (oldIcon) {
                oldIcon.destroy();
            }

            this._appIcon.set_child(this._createAppIconTexture());

            this._updateDominantColor();
        }

        _updateDominantColor() {

            if (this.dominantColor || (
                !this._config.backlightDominantColor &&
                !this._config.indicatorDominantColor
            )) {
                return;
            }
            
            this.dominantColor = AppButton._dominantColorCache[this.appId];

            if (!this.dominantColor) {

                this.dominantColor = new DominantColorExtractor(this._iconProvider, this._appIcon.get_child()).getColor();

                AppButton._dominantColorCache[this.appId] = this.dominantColor;
            }

            this._updateStyle();

            this._indicator?.updateStyle();
        }

        _createAppIconTexture(scale) {

            const customIcon = (
                this._config.customIconPath ?
                this._iconProvider.getCustomIcon(this._config.customIconPath) :
                null
            ); 

            if (customIcon) {

                const result = new St.Icon({
                    icon_size: this._config.iconTextureSize * (scale || 1),
                    gicon: customIcon
                });

                return result;

            } else if (this._config.customIconPath) {
    
                // avoid loading the broken icon again
                this._config.customIconPath = null;
    
            }

            return this.app.create_icon_texture(this._config.iconTextureSize * (scale || 1))
        }

        _updateStyle() {

            this.style = `margin-left: ${this._config.spacing}px; margin-right: ${this._config.spacing}px;`;

            this._appIcon.style = (
                // set width as sum of icon size and paddings to give extra space for the icon inside
                // we need the space to allow tuning of the icon size for each application
                `width: ${this._config.iconSize + this._config.iconPadding * 2}px;` +
                `height: ${this._config.iconSize + this._config.iconVerticalPadding * 2}px;` +
                `border-radius: ${this._config.roundness}px;`
            );

            if (this.isActive) {

                this._connections?.add(Main.overview, 'showing', () => {
                    this._appIcon.remove_style_pseudo_class('active');
                    this._updateStyle();
                });

                this._connections?.add(Main.overview, 'hiding', () => this._updateStyle());

                // don't highlight app buttons when Overview is shown
                // this prevents ugly flickering when selecting windows and changing workspaces
                if (!Main.overview._shown) {

                    this._appIcon.add_style_pseudo_class('active');

                    this._setBacklightColor();
                }

                return;
            }

            this._appIcon.remove_style_pseudo_class('active');

            this._connections?.removeScope(['showing','hiding']);
        }

        _setBacklightColor() {

            // check if intensity is 0
            if (!this._config.backlightIntensity) {
                return;
            }

            const backlightColor = (
                this._config.backlightDominantColor && this.dominantColor ?
                this.dominantColor :
                this._config.backlightColor
            );

            if (!backlightColor) {
                return;
            }

            let appIconStyle = this._appIcon.style || '';

            appIconStyle += 'background-gradient-direction: vertical;';

            const startIntensity = this._config.backlightIntensity - 1;

            appIconStyle += (`background-gradient-start: rgba(
                ${backlightColor.r},
                ${backlightColor.g},
                ${backlightColor.b},
                ${startIntensity >= 0 ? '0.' + startIntensity : 0}
            );`);

            appIconStyle += (`background-gradient-end: rgba(
                ${backlightColor.r},
                ${backlightColor.g},
                ${backlightColor.b},
                ${'0.' + this._config.backlightIntensity}
            );`);

            this._appIcon.style = appIconStyle;
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

            this._stopUpdateIconGeometryQueue();

            this._updateIconGeometryTimeout = Timeout.idle(100).run(() => {
                this._updateIconGeometryTimeout = null;
                this._updateIconGeometry();
            });
        }

        _stopUpdateIconGeometryQueue() {
            this._updateIconGeometryTimeout?.destroy();
            this._updateIconGeometryTimeout = null;
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

            const rect = new Mtk.Rectangle();

            [rect.x, rect.y] = this.get_transformed_position();

            rect.x += width / 2;

            // when buttons on the top
            if (rect.y < 100) {
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

            if (!appWindows.length) {
                return result;
            }

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
            if (!window || window.has_focus() || !this.isActive) {
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

        _focus() {

            let isFocused = (
                this.has_key_focus() ||
                this._menu?.isOpen
            );

            // show tooltip when focused and menu is not open
            this._toggleTooltip(isFocused && !this._menu?.isOpen);

            if (isFocused) {
                
                this._appIcon.add_style_pseudo_class('focus');

                this._triggerState(this._menu?.isOpen ? 'menu' : 'focus');

                return;
            }

            this._appIcon.remove_style_pseudo_class('focus');
        }

        _hover() {

            this._toggleTooltip(this.hover);

            this._triggerState('hover');

            if (this.isActive && this.hover) {
                this._addCycledWindow(this.activeWindow);
                return;
            }
            
            this._resetCycledWindows();
        }

        _buttonPress() {

            const appIconTexture = this._appIcon.get_child();

            appIconTexture?.set_pivot_point(0.5, 0.5);

            appIconTexture?.ease({
                scale_x: 0.9,
                scale_y: 0.9,
                duration: 200
            });

            return Clutter.EVENT_PROPAGATE;
        }

        _buttonRelease() {

            this._appIcon.get_child()?.ease({
                scale_x: 1,
                scale_y: 1,
                duration: 100
            });

            return Clutter.EVENT_PROPAGATE;
        }

        _addCycledWindow(window) {

            if (!window) {
                return;
            }

            if (!this._cycledWindows) {
                this._cycledWindows = new Set();
            }

            if (!this._cycledWindows.has(window)) {
                this._cycledWindows.add(window);
            }
        }

        _resetCycledWindows() {
            this._cycledWindows = null;
        }

        _toggleTooltip(show) {

            if (!this._config.enableTooltips) {
                return;
            }

            if (show) {

                if (this._tooltip) {
                    return;
                }

                this._tooltip = new AppButtonTooltip(this, this._settings, this._iconProvider);
                return;
            }

            this._tooltip?.destroy(true);
            this._tooltip = null;
        }

        _setNotifications(count) {

            if (this.notifications === count) {
                return;
            }

            this.notifications = count;

            this._notificationBadge?.rerender();

            this._tooltip?.rerender();
        }

        _isValid() {
            return this.mapped && this.get_stage() !== null;
        }

        _triggerState(state) {

            if (!state || !this._stateHandler) {
                return;
            }

            this._stateHandler(this, state);
        }

        //#endregion private methods
    }
);
