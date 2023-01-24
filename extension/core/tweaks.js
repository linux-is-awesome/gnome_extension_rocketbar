/* exported Tweaks */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import { Main, HotCorner, Keyboard, SwitcherPopup, WorkspaceSwitcherPopup, AppMenu } from './legacy.js';
import { Context } from './context.js';
import { Config } from '../utils/config.js';
import { Type, Event, Delay } from './enums.js';
import { DefaultSoundVolumeControlClient } from '../services/soundVolumeService.js';

const HIDDEN_OVERVIEW_DASH_HEIGHT = 40;
const PANEL_STATUS_AREA_ACTIVITIES = 'activities'; 
const DEFAULT_INPUT_SOURCE = '0';

/** @enum {string} */
const MouseButton = {
    Left: 'left_button',
    Right: 'right_button',
    Middle: 'middle_button'
};

/** @enum {string} */
const PanelScrollAction = {
    ChangeSoundVolume: 'change_sound_volume',
    SwitchWorkspace: 'switch_workspace'
};

/** @enum {string} */
const ConfigFields = {
    overviewKillDash: 'overview-kill-dash',
    panelScrollAction: 'panel-scroll-action',
    enablePanelMiddleButtonHandler: 'panel-enable-middle-button',
    enableFullscreenHotCorner: 'hotcorner-enable-in-fullscreen',
    enableOverviewClickHandler: 'overview-enable-empty-space-clicks',
    activitiesShowAppsButton: 'activities-show-apps-button',
    soundVolumeStep: 'sound-volume-control-change-speed',
    soundVolumeStepCtrl: 'sound-volume-control-change-speed-ctrl',
    appButtonMenuRequireClick: 'appbutton-menu-require-click',
    panelMenuRequireClick: 'panel-menu-require-click',
    lockscreenPrimaryInput: 'lockscreen-primary-input',
    lockscreenAnimationDelay: 'lockscreen-animation-delay',
    enableSwitcherPopupDelay: 'switcherpopup-enable-show-delay',
    switcherPopupDelay: 'switcherpopup-show-delay',
    enableSwitcherPopupHandler: 'switcherpopup-enable-handler'
};

class Tweak {
    /** @param {Object.<string, string|number|boolean>} _ */
    toggle(_ = {}) {};
    destroy() {};
}

class KillOverviewDashTweak extends Tweak {

    /** @type {() => void} */
    #backup = null;

    toggle({ overviewKillDash }) {
        if (!this.#canToggle({ overviewKillDash })) return;
        if (overviewKillDash) this.#enable();
        else this.#disable();
    }

    destroy() {
        if (!this.#backup) return;
        this.#disable();
    }

    #canToggle({ overviewKillDash }) {
        if (!Main._deferredWorkData || !Main.overview?.dash?._workId) return false;
        if (overviewKillDash && this.#backup) return false;
        if (!overviewKillDash && !this.#backup) return false;
        return true;
    }

    #enable() {
        const deferredWorkData = Main._deferredWorkData[Main.overview.dash._workId];
        if (!deferredWorkData) return;
        this.#backup = deferredWorkData.callback;
        deferredWorkData.callback = () => {};
        Main.overview.dash._box?.get_children()?.forEach(appIcon => appIcon.destroy());
        Main.overview.dash.showAppsButton?.hide();
        Main.overview.dash._background?.hide();
        Main.overview.dash._separator = null;
        Main.overview.dash.height = HIDDEN_OVERVIEW_DASH_HEIGHT;
    }

    #disable() {
        const deferredWorkData = Main._deferredWorkData[Main.overview.dash._workId];
        if (!deferredWorkData) return;
        Main.overview.dash.showAppsButton?.show();
        Main.overview.dash._background?.show();
        Main.overview.dash.set_size(-1, -1);
        Main.overview.dash.setMaxSize(-1, -1);
        deferredWorkData.callback = this.#backup;
        this.#backup = null;
    }

}

class OverviewClicksTweak extends Tweak {

    /** @type {Clutter.ClickAction} */
    #clickAction = null;

    toggle({ enableOverviewClickHandler }) {
        if (!this.#canToggle({ enableOverviewClickHandler })) return;
        if (enableOverviewClickHandler) this.#enable();
        else this.#disable();
    }

    destroy() {
        if (!this.#clickAction) return;
        this.#disable();
    }

    #canToggle({ enableOverviewClickHandler }) {
        if (typeof Main.overview?.toggle !== Type.Function) return false;
        if (typeof Main.overview?._overview?._controls?._toggleAppsPage !== Type.Function) return false;
        if (enableOverviewClickHandler && this.#clickAction) return false;
        if (!enableOverviewClickHandler && !this.#clickAction) return false;
        return true;
    }

    #enable() {
        this.#clickAction = new Clutter.ClickAction();
        this.#clickAction.connect(Event.Clicked, event => {
            switch (event?.get_button()) {
                case Clutter.BUTTON_PRIMARY:
                    return Main.overview.toggle();
                case Clutter.BUTTON_SECONDARY:
                    return Main.overview._overview._controls._toggleAppsPage();
                default: return;
            }
        });
        Main.overview._overview._controls.reactive = true;
        Main.overview._overview._controls.add_action(this.#clickAction);
    }

    #disable() {
        Main.overview._overview._controls.reactive = false;
        Main.overview._overview._controls.remove_action(this.#clickAction);
        this.#clickAction = null;
    }

}

class ActivitiesClicksTweak extends Tweak {

    /** @type {Object.<string, number>} */
    #buttonMapping = {
        [MouseButton.Left]: Clutter.BUTTON_PRIMARY,
        [MouseButton.Right]: Clutter.BUTTON_SECONDARY,
        [MouseButton.Middle]: Clutter.BUTTON_MIDDLE
    };

    /** @type {number} */
    #button = null;

    toggle({ activitiesShowAppsButton }) {
        if (!this.#canToggle()) return;
        this.#button = this.#buttonMapping[activitiesShowAppsButton];
        const activitiesButton = Main.panel.statusArea[PANEL_STATUS_AREA_ACTIVITIES];
        if (!this.#button || !activitiesButton) return this.destroy();
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [[activitiesButton, [Event.Captured], (_, event) => this.#handleEvent(event)]]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#button = null;
    }

    #canToggle() {
        if (!Main.panel?.statusArea) return false;
        if (typeof Main.overview?.shouldToggleByCornerOrButton !== Type.Function) return false;
        if (typeof Main.overview?._overview?._controls?._toggleAppsPage !== Type.Function) return false;
        return true;
    }

    #handleEvent(event) {
        if (event?.type() !== Clutter.EventType.BUTTON_RELEASE) return Clutter.EVENT_PROPAGATE;
        const eventButton = event.get_button();
        if (eventButton !== this.#button) return Clutter.EVENT_PROPAGATE;
        if (!Main.overview.shouldToggleByCornerOrButton()) return Clutter.EVENT_PROPAGATE;
        if (Main.overview.visible &&
            Main.overview._overview._controls.dash?.showAppsButton?.checked) return Clutter.EVENT_PROPAGATE;
        Main.overview._overview._controls._toggleAppsPage();
        return Clutter.EVENT_STOP;
    }

}

class HotCornerTweak extends Tweak {

    /** @type {() => void} */
    #backup = null;

    toggle({ enableFullscreenHotCorner }) {
        if (!this.#canToggle({ enableFullscreenHotCorner })) return;
        if (enableFullscreenHotCorner) this.#enable();
        else this.#disable();
    }

    destroy() {
        if (!this.#backup) return;
        this.#disable();
    }

    #canToggle({ enableFullscreenHotCorner }) {
        if (!HotCorner.prototype._toggleOverview) return false;
        if (typeof Main.overview?.toggle !== Type.Function) return false;
        if (typeof Main.overview?.shouldToggleByCornerOrButton !== Type.Function) return false;
        if (enableFullscreenHotCorner && this.#backup) return false;
        if (!enableFullscreenHotCorner && !this.#backup) return false;
        return true;
    }

    #enable() {
        this.#backup = HotCorner.prototype._toggleOverview;
        HotCorner.prototype._toggleOverview = function () {
            if (!Main.overview.shouldToggleByCornerOrButton()) return;
            Main.overview.toggle();
            if (!Main.overview.animationInProgress) return;
            this._ripples?.playAnimation(this._x, this._y);
        };
        Main.layoutManager?._updateHotCorners();
    }

    #disable() {
        HotCorner.prototype._toggleOverview = this.#backup;
        Main.layoutManager?._updateHotCorners();
        this.#backup = null;
    }

}

// TODO: implement NightLight customization options
class NightLightTweak extends Tweak {

    #settings = new Gio.Settings({
        schema_id: 'org.gnome.settings-daemon.plugins.color'
    });

    toggle() {
        this.#settings?.set_uint('night-light-temperature', 5000);
        this.#restore();
    }

    destroy() {
        Context.jobs.removeAll(this);
        this.#settings?.run_dispose();
        this.#settings = null;
    }

    #restore() {
        if (Main.layoutManager?.screenShieldGroup?.visible) return;
        if (!this.#settings?.get_boolean('night-light-enabled')) return;
        this.#settings.set_boolean('night-light-enabled', false);
        Context.jobs.new(this, Delay.Queue).then(() => {
            this.#settings?.set_boolean('night-light-enabled', true)
            Context.jobs.removeAll(this);
        });
    }

}

class SwitcherPopupsTweak extends Tweak {

    /** @type {number} */
    #backupDelay = SwitcherPopup.POPUP_DELAY_TIMEOUT;

    /** @type {(...args) => *} */
    #backupFunction = null;

    toggle(config) {
        const { enableSwitcherPopupHandler, enableSwitcherPopupDelay, switcherPopupDelay } = config;
        if (enableSwitcherPopupHandler && !this.#backupFunction) this.#setPopupHandler();
        else if (!enableSwitcherPopupHandler && this.#backupFunction) this.#removePopupHandler();
        if (typeof this.#backupDelay !== Type.Number) return;
        if (enableSwitcherPopupDelay && typeof switcherPopupDelay === Type.Number) {
            SwitcherPopup.POPUP_DELAY_TIMEOUT = switcherPopupDelay;
        } else SwitcherPopup.POPUP_DELAY_TIMEOUT = this.#backupDelay;
    }

    destroy() {
        if (this.#backupFunction) this.#removePopupHandler();
        if (typeof this.#backupDelay === Type.Number) {
            SwitcherPopup.POPUP_DELAY_TIMEOUT = this.#backupDelay;
        }
        this.#backupFunction = null;
        this.#backupDelay = null;
    }

    #setPopupHandler() {
        this.#backupFunction = Main.pushModal;
        Main.pushModal = (actor, params) => {
            if (actor instanceof SwitcherPopup.SwitcherPopup === false) return this.#backupFunction(actor, params);
            const originSetKeyFocus = global.stage.set_key_focus;
            global.stage.set_key_focus = () => {};
            const result = this.#backupFunction(actor, params);
            global.stage.set_key_focus = originSetKeyFocus;
            return result;
        };
    }

    #removePopupHandler() {
        Main.pushModal = this.#backupFunction;
        this.#backupFunction = null;
    }

}

// TODO: implement alter scroll action option
class PanelScrollTweak extends Tweak {

    /** @type {DefaultSoundVolumeControlClient} */
    #soundVolumeControlClient = null;

    /** @type {Job} */
    #switchWorkspaceDelay = null;

    /** @type {Object.<string, number>} */
    #moveDirection = {
        [Clutter.ScrollDirection.UP]: Meta.MotionDirection.LEFT,
        [Clutter.ScrollDirection.DOWN]: Meta.MotionDirection.RIGHT,
        [Clutter.ScrollDirection.LEFT]: Meta.MotionDirection.LEFT,
        [Clutter.ScrollDirection.RIGHT]: Meta.MotionDirection.RIGHT
    };

    /** @type {WorkspaceSwitcherPopup} */
    get #workspaceSwitcherPopup() {
        if (Main.wm._workspaceSwitcherPopup) return Main.wm._workspaceSwitcherPopup;
        Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup();
        Main.wm._workspaceSwitcherPopup.connect(Event.Destroy, () => Main.wm._workspaceSwitcherPopup = null);
        return Main.wm._workspaceSwitcherPopup;
    }

    toggle(config) {
        if (!this.#canToggle()) return;
        const { panelScrollAction } = config;
        if (!Object.values(PanelScrollAction).includes(panelScrollAction)) return this.destroy();
        this.#toggleSoundVolumeControlClient(config);
        if (Context.signals.hasClient(this)) return;
        Context.signals.add(this, [[Main.panel, [Event.Scroll], (_, event) => this.#handleScroll(event, config)]]);
    }

    destroy() {
        if (!Context.signals.hasClient(this)) return;
        Context.signals.removeAll(this);
        this.#soundVolumeControlClient?.destroy();
        this.#switchWorkspaceDelay?.destroy();
        this.#soundVolumeControlClient = null;
        this.#switchWorkspaceDelay = null;
    }

    #canToggle() {
        if (!Main.panel) return false;
        if (typeof Main.wm?.actionMoveWorkspace !== Type.Function) return false;
        return true;
    }

    #toggleSoundVolumeControlClient({ panelScrollAction }) {
        if (panelScrollAction === PanelScrollAction.ChangeSoundVolume) {
            if (this.#soundVolumeControlClient) return;
            this.#soundVolumeControlClient = new DefaultSoundVolumeControlClient();
            return;
        }
        this.#soundVolumeControlClient?.destroy();
        this.#soundVolumeControlClient = null;
    }

    #handleScroll(event, config) {
        if (!event || !config) return Clutter.EVENT_PROPAGATE;
        const scrollDirection = event.get_scroll_direction();
        if (!this.#moveDirection[scrollDirection]) return Clutter.EVENT_PROPAGATE;
        let { panelScrollAction } = config;
        const { soundVolumeStep, soundVolumeStepCtrl } = config;
        if (scrollDirection === Clutter.ScrollDirection.LEFT || scrollDirection === Clutter.ScrollDirection.RIGHT) {
            panelScrollAction = PanelScrollAction.SwitchWorkspace;
        }
        switch (panelScrollAction) {
            case PanelScrollAction.SwitchWorkspace:
                this.#switchWorkspace(scrollDirection);
                break;
            case PanelScrollAction.ChangeSoundVolume:
                const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
                let step = isCtrlPressed ? soundVolumeStepCtrl : soundVolumeStep;
                step = scrollDirection === Clutter.ScrollDirection.DOWN ? -step : step;
                this.#soundVolumeControlClient?.addVolume(step);
                break;
            default: return Clutter.EVENT_PROPAGATE;
        }
        return Clutter.EVENT_STOP;
    }

    #switchWorkspace(scrollDirection) {
        if (this.#switchWorkspaceDelay) return;
        this.#switchWorkspaceDelay = Context.jobs.new(this, Delay.Sleep).then(() => {
            this.#switchWorkspaceDelay?.destroy();
            this.#switchWorkspaceDelay = null;
        });
        const activeWorkspace = global.workspace_manager?.get_active_workspace();
        const nextWorkspace = activeWorkspace?.get_neighbor(this.#moveDirection[scrollDirection]);
        if (!nextWorkspace) return;
        if (Main.overview?.visible) return Main.wm.actionMoveWorkspace(nextWorkspace);
        Main.osdWindowManager?.hideAll();
        this.#workspaceSwitcherPopup.display(nextWorkspace.index());
        Main.wm.actionMoveWorkspace(nextWorkspace);
    }

}

class PanelMiddleClickTweak extends Tweak {

    /** @type {DefaultSoundVolumeControlClient} */
    #soundVolumeControlClient = null;

    toggle({ enablePanelMiddleButtonHandler }) {
        if (!this.#canToggle({ enablePanelMiddleButtonHandler })) return;
        if (!enablePanelMiddleButtonHandler) return this.destroy();
        this.#soundVolumeControlClient = new DefaultSoundVolumeControlClient();
        Context.signals.add(this, [[Main.panel, [Event.ButtonPress], (_, event) => this.#handleEvent(event)]]);
    }

    #canToggle({ enablePanelMiddleButtonHandler }) {
        if (!Main.panel) return false;
        if (enablePanelMiddleButtonHandler && this.#soundVolumeControlClient) return false;
        if (!enablePanelMiddleButtonHandler && !this.#soundVolumeControlClient) return false;
        return true;
    }

    destroy() {
        if (!this.#soundVolumeControlClient) return;
        Context.signals.removeAll(this);
        this.#soundVolumeControlClient?.destroy();
        this.#soundVolumeControlClient = null;
    }

    #handleEvent(event) {
        if (event?.get_source() !== Main.panel ||
            event.get_button() !== Clutter.BUTTON_MIDDLE) return Clutter.EVENT_PROPAGATE;
        this.#soundVolumeControlClient?.toggleMute();
        return Clutter.EVENT_STOP;
    }

}

class PanelMenuManagerTweak extends Tweak {

    /** @type {(...args) => void} */
    #backup = null;

    toggle(config) {
        if (typeof Main.panel?.menuManager?._changeMenu !== Type.Function) return;
        const { appButtonMenuRequireClick, panelMenuRequireClick } = config;
        if (!appButtonMenuRequireClick && !panelMenuRequireClick) return this.destroy();
        if (this.#backup) return;
        this.#backup = Main.panel.menuManager._changeMenu;
        Main.panel.menuManager._changeMenu = this.#getCustomFunction(config);
    }

    destroy() {
        if (!this.#backup) return;
        Main.panel.menuManager._changeMenu = this.#backup;
        this.#backup = null;
    }

    #getCustomFunction(config) {
        return newMenu => {
            if (!this.#backup || !config) return;
            const { appButtonMenuRequireClick, panelMenuRequireClick } = config;
            const isNewAppMenu = newMenu instanceof AppMenu;
            const isActiveAppMenu = Main.panel.menuManager.activeMenu instanceof AppMenu;
            if (panelMenuRequireClick && !isActiveAppMenu) return;
            if (appButtonMenuRequireClick && (isActiveAppMenu || isNewAppMenu)) return;
            if (!appButtonMenuRequireClick && panelMenuRequireClick && !isNewAppMenu) return;
            this.#backup(newMenu);
        };
    }

}

class LockscreenTweak extends Tweak {

    /** @type {Map} */
    #backup = Context.getSessionCache(this.constructor.name);

    toggle({ lockscreenPrimaryInput, lockscreenAnimationDelay }) {
        if (!this.#canToggle()) return;
        if (!lockscreenPrimaryInput && !lockscreenAnimationDelay) return this.#disable();
        const lockDialogGroup = Main.screenShield._lockDialogGroup;
        const origin = this.#backup.get('origin');
        if (typeof origin !== Type.Function) this.#backup.set('origin', lockDialogGroup.ease.bind(lockDialogGroup));
        lockDialogGroup.ease = this.#getCustomEaseFunction(lockscreenPrimaryInput, lockscreenAnimationDelay);
    }

    destroy() {
        if (!this.#backup) return;
        if (!Context.isSessionLocked) this.#disable();
        this.#backup = null;
    }

    #canToggle() {
        if (!this.#backup) return false;
        if (!Main.screenShield?._lockDialogGroup) return false;
        if (typeof Keyboard.getInputSourceManager !== Type.Function) return false;
        return true;
    }

    #disable() {
        const origin = this.#backup.get('origin');
        if (typeof origin !== Type.Function) return;
        Main.screenShield._lockDialogGroup.ease = origin;
        this.#backup.clear();
    }

    #getCustomEaseFunction(forcePrimaryInput, animationDelay) {
        const origin = this.#backup.get('origin');
        const inputSourceManager = Keyboard.getInputSourceManager();
        const onCompleteHandler = () => {
            if (!inputSourceManager) return;
            if (!Main.screenShield.actor?.visible) {
                if (!inputSourceManager._sourcesPerWindowChanged ||
                    !inputSourceManager._setPerWindowInputSource) return;
                inputSourceManager._sourcesPerWindowChanged();
                if (inputSourceManager._sourcesPerWindow) inputSourceManager._setPerWindowInputSource();
                return;
            }
            if (inputSourceManager._focusWindowNotifyId) {
                Main.overview?.disconnectObject(inputSourceManager);
                global.display.disconnect(inputSourceManager._focusWindowNotifyId);
                inputSourceManager._focusWindowNotifyId = 0;
                inputSourceManager._sourcesPerWindow = false;
            }
            if (!forcePrimaryInput) return;
            forcePrimaryInput = false;
            const primaryInput = inputSourceManager.inputSources[DEFAULT_INPUT_SOURCE];
            primaryInput?.activate();
        };
        return (params) => {
            if (!params) return origin();
            params.delay = animationDelay;
            const onComplete = params.onComplete;
            params.onComplete = () => {
                if (onComplete) onComplete();
                onCompleteHandler();
            };
            origin(params);
        };
    }

}

/**
 * https://gitlab.gnome.org/GNOME/mutter/-/issues/401
 * 
 * https://github.com/pop-os/pop/issues/2331
 * 
 * ...
 */
class WindowSwitchScrollFixTweak extends Tweak {

    #vdevice = null;

    toggle() {
        if (this.#vdevice) return;
        const defaultSeat = Clutter.get_default_backend().get_default_seat();
        this.#vdevice = defaultSeat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
        Context.signals.add(this, [[global.display, [Event.FocusWindow], () => this.#handleWindowFocus()]]);
    }

    destroy() {
        if (!this.#vdevice) return;
        Context.signals.removeAll(this);
        this.#vdevice = null;
    }

    #handleWindowFocus() {
        const [x, y] = global.get_pointer();
        this.#vdevice?.notify_absolute_motion(global.get_current_time(), x, y);
    }

}

export class Tweaks {

    /** @type {Object.<string, string|number|boolean>} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /** @type {Object.<string, Tweak>} */
    #tweaks = {
        [KillOverviewDashTweak.name]: new KillOverviewDashTweak(),
        [OverviewClicksTweak.name]: new OverviewClicksTweak(),
        [ActivitiesClicksTweak.name]: new ActivitiesClicksTweak(),
        [HotCornerTweak.name]: new HotCornerTweak(),
        [NightLightTweak.name]: new NightLightTweak(),
        [SwitcherPopupsTweak.name]: new SwitcherPopupsTweak(),
        [PanelMenuManagerTweak.name]: new PanelMenuManagerTweak(),
        [PanelScrollTweak.name]: new PanelScrollTweak(),
        [PanelMiddleClickTweak.name]: new PanelMiddleClickTweak(),
        [LockscreenTweak.name]: new LockscreenTweak(),
        [WindowSwitchScrollFixTweak.name]: new WindowSwitchScrollFixTweak()
    };

    /** @type {Object.<string, string>} */
    #mapping = {
        [ConfigFields.overviewKillDash]: KillOverviewDashTweak.name,
        [ConfigFields.enableOverviewClickHandler]: OverviewClicksTweak.name,
        [ConfigFields.activitiesShowAppsButton]: ActivitiesClicksTweak.name,
        [ConfigFields.enableFullscreenHotCorner]: HotCornerTweak.name,
        [ConfigFields.enableSwitcherPopupHandler]: SwitcherPopupsTweak.name,
        [ConfigFields.enableSwitcherPopupDelay]: SwitcherPopupsTweak.name,
        [ConfigFields.switcherPopupDelay]: SwitcherPopupsTweak.name,
        [ConfigFields.panelMenuRequireClick]: PanelMenuManagerTweak.name,
        [ConfigFields.appButtonMenuRequireClick]: PanelMenuManagerTweak.name,
        [ConfigFields.panelScrollAction]: PanelScrollTweak.name,
        [ConfigFields.enablePanelMiddleButtonHandler]: PanelMiddleClickTweak.name,
        [ConfigFields.lockscreenPrimaryInput]: LockscreenTweak.name,
        [ConfigFields.lockscreenAnimationDelay]: LockscreenTweak.name
    };

    constructor() {
        this.#handleConfig();
    }

    destroy() {
        if (!this.#tweaks) return;
        Context.signals.removeAll(this);
        for (const key in this.#tweaks) this.#tweaks[key].destroy();
        this.#tweaks = null;
    }

    /**
     * @param {string} settingsKey 
     */
    #handleConfig(settingsKey) {
        if (!this.#tweaks) return;
        if (typeof settingsKey === Type.String) {
            const tweak = this.#mapping[settingsKey];
            this.#tweaks[tweak]?.toggle(this.#config);
            return;
        }
        for (const key in this.#tweaks) this.#tweaks[key].toggle(this.#config);
    }

}
