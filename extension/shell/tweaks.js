//#region imports

const { GLib } = imports.gi;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const HotCorner = imports.ui.layout.HotCorner;

// custom modules import
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { AppButton } = Me.imports.ui.appButton;
const { SoundVolumeControl } = Me.imports.utils.soundVolumeControl;
const { Connections } = Me.imports.utils.connections;

//#endregion imports

var ShellTweaks = class {

    constructor(settings) {

        this._settings = settings;

        // enable tweaks with a small delay
        this._initTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {

            this._initTimeout = null;

            this._handleSettings();

            this._createConnections();

            return GLib.SOURCE_REMOVE;
        });
    }

    destroy() {

        // clear init timeout if exists
        if (this._initTimeout) {
            GLib.source_remove(this._initTimeout);
        }

        // remove connections
        this._connections?.destroy();

        this._removePanelScrollHandler();

        this._removePanelMiddleButtonHandler();

        this._disableFullscreenHotCorner();

        this._disableActivitiesClickHandler();

        this._removeOverviewClickHandler();

        this._restoreOverviewDash();

        this._soundVolumeControl?.destroy();
        this._soundVolumeControl = null;
    }

    _createConnections() {
        this._connections = new Connections();
        this._connections.add(this._settings, 'changed::overview-kill-dash', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::panel-enable-scroll', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::panel-enable-middle-button', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::hotcorner-enable-in-fullscreen', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::activities-show-apps-button', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::overview-enable-empty-space-clicks', () => this._handleSettings());
        this._connections.add(this._settings, 'changed::panel-scroll-volume-change-speed', () => this._setConfig());
        this._connections.add(this._settings, 'changed::panel-scroll-volume-change-speed-ctrl', () => this._setConfig());
    }

    _handleSettings() {

        this._setConfig();

        if (this._config.overviewKillDash) {
            this._killOverviewDash();
        } else {
            this._restoreOverviewDash();
        }

        if (this._config.enablePanelScrollHandler ||
                this._config.enablePanelMiddleButtonHandler) {

            if (!this._soundVolumeControl) {
                this._soundVolumeControl = new SoundVolumeControl();
            }

        } else {
            this._soundVolumeControl?.destroy();
            this._soundVolumeControl = null;
        }

        if (this._config.enablePanelScrollHandler) {
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
    }

    _setConfig() {
        this._config = {
            overviewKillDash: this._settings.get_boolean('overview-kill-dash'),
            enablePanelScrollHandler: this._settings.get_boolean('panel-enable-scroll'),
            enablePanelMiddleButtonHandler: this._settings.get_boolean('panel-enable-middle-button'),
            enableFullscreenHotCorner: this._settings.get_boolean('hotcorner-enable-in-fullscreen'),
            enableOverviewClickHandler: this._settings.get_boolean('overview-enable-empty-space-clicks'),
            activitiesShowAppsButton: this._settings.get_string('activities-show-apps-button'),
            soundVolumeStep: this._settings.get_int('panel-scroll-volume-change-speed'),
            soundVolumeStepCtrl: this._settings.get_int('panel-scroll-volume-change-speed-ctrl')
        };
    }

    //#region panel scroll handling

    _addPanelScrollHandler() {

        if (this._panelScrollHandler) {
            return;
        }

        this._panelScrollHandler = Main.panel.connect(
            'scroll-event',
            (actor, event) => this._handlePanelScroll(event)
        );
    }

    _removePanelScrollHandler() {

        if (!this._panelScrollHandler) {
            return;
        }

        Main.panel.disconnect(this._panelScrollHandler);

        this._panelScrollHandler = null;
    }

    _handlePanelScroll(event) {
        
        const scrollDirection = event?.get_scroll_direction();

        // handle only 2 directions: UP and DOWN
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
                scrollDirection !== Clutter.ScrollDirection.DOWN) {
            return Clutter.EVENT_PROPAGATE;
        }

        // change sound volume

        if (!this._soundVolumeControl) {
            return Clutter.EVENT_PROPAGATE;
        }

        const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
        const soundVolumeStep = (
            isCtrlPressed ?
            this._config.soundVolumeStepCtrl :
            this._config.soundVolumeStep
        );

        this._soundVolumeControl.addVolume(
            scrollDirection === Clutter.ScrollDirection.UP ?
            soundVolumeStep :
            -soundVolumeStep
        );

        return Clutter.EVENT_STOP;
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

}