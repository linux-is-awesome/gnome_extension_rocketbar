/* exported ShellTweaks */

//#region imports

const { Clutter, Meta } = imports.gi;
const Main = imports.ui.main;
const HotCorner = imports.ui.layout.HotCorner;
const Keyboard = imports.ui.status.keyboard
const SwitcherPopup = imports.ui.switcherPopup;
const { WorkspaceSwitcherPopup } = imports.ui.workspaceSwitcherPopup;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButtonMenu } = Me.imports.ui.appButtonMenu;
const { SoundVolumeControl } = Me.imports.utils.soundVolumeControl;
const { Connections } = Me.imports.utils.connections;
const { ScrollHandler } = Me.imports.utils.scrollHandler;
const { Timeout } = Me.imports.utils.timeout;

//#endregion imports

var ShellTweaks = class {

    constructor(settings) {

        this._settings = settings;

        // enable tweaks with a small delay
        this._initTimeout = Timeout.idle().run(() => {

            this._initTimeout = null;

            this._handleSettings();

            this._createConnections();

        });
    }

    destroy() {

        // clear init timeout if exists
        this._initTimeout?.destroy();

        // remove connections
        this._connections?.destroy();

        this._removePanelScrollHandler();

        this._removePanelMiddleButtonHandler();

        this._disableFullscreenHotCorner();

        this._disableActivitiesClickHandler();

        this._removeOverviewClickHandler();

        this._restoreOverviewDash();

        this._restorePanelMenuManagerBehavior();

        this._destroySoundVolumeControl();

        this._restoreSwitcherPopupDelay();

        this._removeSwitcherPopupHandler();

        this._handleLockScreen();
    }

    _createConnections() {
        this._connections = new Connections();
        this._connections.addScope(this._settings, [
            'changed::sound-volume-control-change-speed',
            'changed::sound-volume-control-change-speed-ctrl',
            'changed::lockscreen-primary-input'], () => this._setConfig());
        this._connections.addScope(this._settings, [
            'changed::overview-kill-dash',
            'changed::panel-scroll-action',
            'changed::panel-enable-middle-button',
            'changed::hotcorner-enable-in-fullscreen',
            'changed::activities-show-apps-button',
            'changed::overview-enable-empty-space-clicks',
            'changed::appbutton-menu-require-click',
            'changed::panel-menu-require-click',
            'changed::switcherpopup-enable-show-delay',
            'changed::switcherpopup-show-delay',
            'changed::switcherpopup-enable-handler'], () => this._handleSettings());
    }

    _handleSettings() {

        this._setConfig();

        if (this._config.overviewKillDash) {
            this._killOverviewDash();
        } else {
            this._restoreOverviewDash();
        }

        if (this._config.panelScrollAction === 'change_sound_volume' ||
                this._config.enablePanelMiddleButtonHandler) {

            if (!this._soundVolumeControl) {
                this._soundVolumeControl = new SoundVolumeControl();
            }

        } else {
            this._destroySoundVolumeControl();
        }

        if (this._config.panelScrollAction !== 'none') {
            this._addPanelScrollHandler();
        } else {
            this._removePanelScrollHandler();
        }

        if (this._config.enablePanelMiddleButtonHandler) {
            this._addPanelMiddleButtonHandler();
        } else {
            this._removePanelMiddleButtonHandler();
        }

        if (this._config.enableFullscreenHotCorner) {
            this._enableFullscreenHotCorner();
        } else {
            this._disableFullscreenHotCorner();
        }

        if (this._config.activitiesShowAppsButton &&
                this._config.activitiesShowAppsButton !== 'none') {
            this._enableActivitiesClickHandler();
        } else {
            this._disableActivitiesClickHandler();
        }

        if (this._config.enableOverviewClickHandler) {
            this._addOverviewClickHandler();
        } else {
            this._removeOverviewClickHandler();
        }

        if (this._config.appButtonMenuRequireClick ||
                this._config.panelMenuRequireClick) {
            this._overridePanelMenuManagerBehavior();
        } else {
            this._restorePanelMenuManagerBehavior();
        }

        if (this._config.enableSwitcherPopupDelay) {
            this._setSwitcherPopupDelay();
        } else {
            this._restoreSwitcherPopupDelay();
        }

        if (this._config.enableSwitcherPopupHandler) {
            this._addSwitcherPopupHandler();
        } else {
            this._removeSwitcherPopupHandler();
        }

    }

    _setConfig() {
        this._config = {
            overviewKillDash: this._settings.get_boolean('overview-kill-dash'),
            panelScrollAction: this._settings.get_string('panel-scroll-action'),
            enablePanelMiddleButtonHandler: this._settings.get_boolean('panel-enable-middle-button'),
            enableFullscreenHotCorner: this._settings.get_boolean('hotcorner-enable-in-fullscreen'),
            enableOverviewClickHandler: this._settings.get_boolean('overview-enable-empty-space-clicks'),
            activitiesShowAppsButton: this._settings.get_string('activities-show-apps-button'),
            soundVolumeStep: this._settings.get_int('sound-volume-control-change-speed'),
            soundVolumeStepCtrl: this._settings.get_int('sound-volume-control-change-speed-ctrl'),
            appButtonMenuRequireClick: this._settings.get_boolean('appbutton-menu-require-click'),
            panelMenuRequireClick: this._settings.get_boolean('panel-menu-require-click'),
            lockscreenPrimaryInput: this._settings.get_boolean('lockscreen-primary-input'),
            enableSwitcherPopupDelay: this._settings.get_boolean('switcherpopup-enable-show-delay'),
            switcherPopupDelay: this._settings.get_int('switcherpopup-show-delay'),
            enableSwitcherPopupHandler: this._settings.get_boolean('switcherpopup-enable-handler')
        };
    }

    _destroySoundVolumeControl() {
        this._soundVolumeControl?.destroy();
        this._soundVolumeControl = null;
    }

    //#region panel scroll handling

    _addPanelScrollHandler() {

        if (this._panelScrollHandler) {
            return;
        }

        this._panelScrollHandler = new ScrollHandler(
            Main.panel,
            (params) => this._handlePanelScroll(params)
        );
    }

    _removePanelScrollHandler() {

        if (!this._panelScrollHandler) {
            return;
        }

        this._panelScrollHandler.destroy();
        this._panelScrollHandler = null;
    }

    _handlePanelScroll(params) {

        const [scrollDirection, isCtrlPressed] = params;

        if (this._config.panelScrollAction === 'switch_workspace') {

            this._switchWorkspace(scrollDirection);

        } else if (this._config.panelScrollAction === 'change_sound_volume') {

            const soundVolumeStep = (
                isCtrlPressed ?
                this._config.soundVolumeStepCtrl :
                this._config.soundVolumeStep
            );

            this._soundVolumeControl?.addVolume(
                scrollDirection === Clutter.ScrollDirection.UP ?
                soundVolumeStep :
                -soundVolumeStep
            );

        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_STOP;
    }

    _switchWorkspace(scrollDirection) {

        if (this._switchWorkspaceTimeout) {
            return;
        }

        this._switchWorkspaceTimeout = Timeout.default(300).run(() => {
            this._switchWorkspaceTimeout = null;
        });

        let moveDirection = (
            scrollDirection === Clutter.ScrollDirection.UP ?
            Meta.MotionDirection.LEFT :
            Meta.MotionDirection.RIGHT
        );

        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const nextWorkspace = activeWorkspace.get_neighbor(moveDirection);

        if (!Main.overview.visible) {

            if (Main.wm._workspaceSwitcherPopup == null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            Main.osdWindowManager.hideAll();

            Main.wm._workspaceSwitcherPopup.display(nextWorkspace.index());
        }

        Main.wm.actionMoveWorkspace(nextWorkspace);
    }

    //#endregion panel scroll handling

    //#region panel middle button handling

    _addPanelMiddleButtonHandler() {

        if (this._panelMiddleButtonHandler) {
            return;
        }

        this._panelMiddleButtonHandler = Main.panel.connect(
            'button-press-event',
            (actor, event) => this._handlePanelMiddleButton(event)
        );
    }

    _removePanelMiddleButtonHandler() {

        if (!this._panelMiddleButtonHandler) {
            return;
        }

        Main.panel.disconnect(this._panelMiddleButtonHandler);

        this._panelMiddleButtonHandler = null;
    }

    _handlePanelMiddleButton(event) {

        // handle middle button press on empty space only
        if (!event || event.get_source() !== Main.panel ||
                event.get_button() !== Clutter.BUTTON_MIDDLE) {
            return Clutter.EVENT_PROPAGATE;
        }

        // mute/unmute sound volume

        this._soundVolumeControl?.toggleMute();

        return Clutter.EVENT_STOP;
    }

    //#endregion middle button handling

    //#region hot corner tweaks

    _enableFullscreenHotCorner() {

        if (this._originalToggleOverview) {
            return;
        }

        // backup the original function
        this._originalToggleOverview = HotCorner.prototype._toggleOverview;

        // override the function
        HotCorner.prototype._toggleOverview = function() {

            if (!Main.overview.shouldToggleByCornerOrButton()) {
                return;
            }
            
            Main.overview.toggle();
            
            if (!Main.overview.animationInProgress) {
                return;
            }
            
            this._ripples.playAnimation(this._x, this._y);
        };

        Main.layoutManager._updateHotCorners();
    }

    _disableFullscreenHotCorner() {

        if (!this._originalToggleOverview) {
            return;
        }

        HotCorner.prototype._toggleOverview = this._originalToggleOverview;
        Main.layoutManager._updateHotCorners();

        this._originalToggleOverview = null;
    }

    //#endregion hot corner tweaks

    //#region activities button tweaks

    _enableActivitiesClickHandler() {

        if (this._activitiesClickHandler) {
            return;
        }

        const activitiesButton = Main.panel.statusArea['activities'];

        this._activitiesClickHandler = activitiesButton.connect('captured_event', (actor, event) => {

            if (!event || event.type() !== Clutter.EventType.BUTTON_RELEASE) {
                return Clutter.EVENT_PROPAGATE;
            }

            const eventButton = event.get_button();

            const buttonMapping = {
                'left_button': Clutter.BUTTON_PRIMARY,
                'right_button': Clutter.BUTTON_SECONDARY,
                'middle_button': Clutter.BUTTON_MIDDLE
            };

            if (!eventButton || !this._config.activitiesShowAppsButton ||
                    buttonMapping[this._config.activitiesShowAppsButton] !== eventButton) {
                return Clutter.EVENT_PROPAGATE;
            }

            if (Main.overview.shouldToggleByCornerOrButton() &&
                    !(Main.overview.visible && Main.overview._overview._controls.dash.showAppsButton.checked)) {

                Main.overview._overview._controls._toggleAppsPage();

                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });
    }

    _disableActivitiesClickHandler() {

        if (!this._activitiesClickHandler) {
            return;
        }

        const activitiesButton = Main.panel.statusArea['activities'];

        activitiesButton.disconnect(this._activitiesClickHandler);

        this._activitiesClickHandler = null;
    }

    //#endregion activities button tweaks

    //#region overview tweaks

    _addOverviewClickHandler() {

        if (this._overviewClickHandler) {
            return;
        }

        // backup the overview reactivity
        this._overviewOldReactivity = Main.overview._overview._controls.reactive;

        // make the overview reactive
        Main.overview._overview._controls.reactive = true;

        // create a click handler
        this._overviewClickHandler = new Clutter.ClickAction();
        this._overviewClickHandler.connect('clicked', action => {

            // just toggle overview when primary button clicked
            if (action.get_button() == Clutter.BUTTON_PRIMARY) {
                Main.overview.toggle();
                return;
            }
            
            // toggle apps page when secondary button clicked
            if (action.get_button() === Clutter.BUTTON_SECONDARY) {
                Main.overview._overview._controls._toggleAppsPage()
            }

        });

        // add click action to the overview
        Main.overview._overview._controls.add_action(this._overviewClickHandler);
    }

    _removeOverviewClickHandler() {

        if (!this._overviewClickHandler) {
            return;
        }

        // restore overview reactivity
        Main.overview._overview._controls.reactive = this._overviewOldReactivity;
        this._overviewOldReactivity = null;

        // remove custom click action from the overview
        Main.overview._overview._controls.remove_action(this._overviewClickHandler);
        this._overviewClickHandler = null;
    }

    _killOverviewDash() {

        if (!Main.overview.dash._workId || this._dashDeferredWorkBackup ) {
            return;
        }

        if (!Main._deferredWorkData[Main.overview.dash._workId]) {
            return;
        }

        this._dashDeferredWorkBackup = Main._deferredWorkData[Main.overview.dash._workId];

         // prevent deferred work from running dash redisplay
        Main._deferredWorkData[Main.overview.dash._workId] = {
            actor: this._dashDeferredWorkBackup.actor,
            callback: () => {}
        }

        // leave a gap below the Workspace Thumbnail
        Main.overview.dash.height = 40;

        Main.overview.dash.showAppsButton.hide();
        Main.overview.dash._background.hide();

        // remove all app icons from the dash
        Main.overview.dash._box.get_children().forEach(appIcon => appIcon.destroy());

        Main.overview.dash._separator = null;
    }

    _restoreOverviewDash() {

        if (!this._dashDeferredWorkBackup || !Main.overview.dash._workId) {
            return;
        }

        Main.overview.dash.showAppsButton.show();
        Main.overview.dash._background.show();

        // restore size of the dash
        Main.overview.dash.height = -1;
        Main.overview.dash.setMaxSize(-1, -1);

        // restore deferred work
        Main._deferredWorkData[Main.overview.dash._workId] = this._dashDeferredWorkBackup;

        this._dashDeferredWorkBackup = null;
    }

    //#endregion overview tweaks

    //#region panel menu manager tweaks

    _overridePanelMenuManagerBehavior() {

        if (this._panelMenuManagerChangeMenu) {
            return;
        }

        this._panelMenuManagerChangeMenu = Main.panel.menuManager._changeMenu;

        Main.panel.menuManager._changeMenu = newMenu => {

            const isNewAppButtonMenu = (newMenu && newMenu instanceof AppButtonMenu);

            const isActiveAppButtonMenu = (
                Main.panel.menuManager.activeMenu &&
                Main.panel.menuManager.activeMenu instanceof AppButtonMenu
            );

            if (this._config.panelMenuRequireClick && !isActiveAppButtonMenu) {
                return;
            }

            if (this._config.appButtonMenuRequireClick &&
                    (isActiveAppButtonMenu || isNewAppButtonMenu)) {
                return;
            }

            if (!this._config.appButtonMenuRequireClick &&
                    this._config.panelMenuRequireClick && !isNewAppButtonMenu) {
                return;
            }

            this._panelMenuManagerChangeMenu(newMenu);

        };
    }

    _restorePanelMenuManagerBehavior() {
    
        if (!this._panelMenuManagerChangeMenu) {
            return;
        }

        Main.panel.menuManager._changeMenu = this._panelMenuManagerChangeMenu;

        this._panelMenuManagerChangeMenu = null;
    }

    //#endregion panel menu manager tweaks

    //#region lockscreen

    _handleLockScreen() {

        if (!Main.sessionMode.isLocked || !this._config.lockscreenPrimaryInput) {
            return;
        }

        const primaryInput = Keyboard.getInputSourceManager()?.inputSources['0'];

        primaryInput?.activate();
    }

    //#endregion lockscreen

    //#region switcher popups

    _setSwitcherPopupDelay() {

        if (!this._switcherPopupDefaultDelay) {
            this._switcherPopupDefaultDelay = SwitcherPopup.POPUP_DELAY_TIMEOUT;
        }

        SwitcherPopup.POPUP_DELAY_TIMEOUT = this._config.switcherPopupDelay;
    }

    _restoreSwitcherPopupDelay() {

        if (!this._switcherPopupDefaultDelay) {
            return;
        }

        SwitcherPopup.POPUP_DELAY_TIMEOUT = this._switcherPopupDefaultDelay;

        this._switcherPopupDefaultDelay = null;
    }

    _addSwitcherPopupHandler() {

        if (this._originalMainPushModal) {
            return;
        }
    
        this._originalMainPushModal = Main.pushModal;

        Main.pushModal = (actor, params) => {

            if (actor && actor instanceof SwitcherPopup.SwitcherPopup) {

                const originalSetKeyFocus = global.stage.set_key_focus;

                global.stage.set_key_focus = () => {};

                const result = this._originalMainPushModal(actor, params);

                global.stage.set_key_focus = originalSetKeyFocus;

                return result;
            }

            return this._originalMainPushModal(actor, params);
        };
    }

    _removeSwitcherPopupHandler() {

        if (!this._originalMainPushModal) {
            return;
        }

        Main.pushModal = this._originalMainPushModal;

        this._originalMainPushModal = null;
    }

    //#endregion switcher popups

}
