/**
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupBaseMenuItem} PopupBaseMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenuItem} PopupMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupSeparatorMenuItem} PopupSeparatorMenuItem
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenuTransitionParams} PopupMenuTransitionParams
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import { AppMenu } from 'resource:///org/gnome/shell/ui/appMenu.js';
import { PopupMenuSection,
         PopupSeparatorMenuItem } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import Context from '../../core/context.js';
import { SliderMenuItem, CollapsibleGroup } from '../base/menu.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { SoundVolumeIcon } from '../../utils/soundVolumeIcon.js';
import { WindowProxy } from '../../utils/taskbar/windowProxy.js';
import { Event, PreferencesPage } from '../../../shared/enums/general.js';
import { SettingsKey } from '../../../shared/enums/settings.js';
import { Label } from '../../../shared/enums/labels.js';
import { ConfigOptions, ActivationBehavior } from '../../../shared/enums/taskbar.js';

const UNWANTED_STYLE_CLASS = 'app-menu';
const STYLE_CLASS = 'rocketbar__popup-menu';

/** @type {{favoritesSection: boolean, showSingleWindow: boolean}} */
const DefaultProps = {
    favoritesSection: true,
    showSingleWindow: true
};

/** @enum {number} */
const MonitorDirection = {
    CurrentMonitor: -1,
    MonitorLeft: Meta.DisplayDirection.LEFT,
    MonitorRight: Meta.DisplayDirection.RIGHT,
    MonitorAbove: Meta.DisplayDirection.UP,
    MonitorBelow: Meta.DisplayDirection.DOWN
};

/** @enum {string} */
const ConfigField = {
    isolateWorkspaces: SettingsKey.IsolateWorkspaces,
    showFavorites: SettingsKey.ShowFavorites
};

class SoundVolumeControlGroup extends CollapsibleGroup {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {SliderMenuItem?} */
    #inputVolumeSlider = null;

    /** @type {SliderMenuItem?} */
    #outputVolumeSlider = null;

    /** @type {boolean} */
    #isSyncing = false;

    /**
     * @param {AppButton?} appButton
     */
    constructor(appButton) {
        super(Label.SoundVolumeControl);
        this.#appButton = appButton;
        this.#inputVolumeSlider = new SliderMenuItem((...args) => this.#setVolume(...args));
        this.#outputVolumeSlider = new SliderMenuItem((...args) => this.#setVolume(...args));
        const menu = this.menu;
        menu.addMenuItem(this.#inputVolumeSlider.actor);
        menu.addMenuItem(this.#outputVolumeSlider.actor);
        menu.connect(Event.OpenStateChanged, () => this.#syncVolume());
        this.actor.connect(Event.Destroy, () => this.#destroy());
    }

    update() {
        const actor = this.actor;
        if (!actor || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl?.hasInput && !soundVolumeControl?.hasOutput) {
            actor.menu?.close();
            actor.hide();
            return;
        }
        this.#inputVolumeSlider.actor.visible = soundVolumeControl.hasInput;
        this.#outputVolumeSlider.actor.visible = soundVolumeControl.hasOutput;
        actor.show();
    }

    /**
     * @param {SliderMenuItem} menuItem
     * @param {boolean} isMute
     */
    #setVolume(menuItem, isMute) {
        if (this.#isSyncing) return;
        if (isMute) return this.#toggleMute(menuItem);
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const slider = menuItem?.slider;
        if (!slider) return;
        const sliderValue = slider.value;
        const isInput = menuItem === this.#inputVolumeSlider;
        if (isInput) {
            soundVolumeControl.inputVolume = sliderValue;
        } else {
            soundVolumeControl.outputVolume = sliderValue;
        }
        menuItem.icon = SoundVolumeIcon(sliderValue, isInput);
    }

    /**
     * @param {SliderMenuItem} menuItem
     */
    #toggleMute(menuItem) {
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const isInput = menuItem === this.#inputVolumeSlider;
        if (isInput) soundVolumeControl.toggleInputMute(() => this.#syncVolume());
        else soundVolumeControl.toggleOutputMute(() => this.#syncVolume());
    }

    #syncVolume() {
        if (!this.isOpen || !this.#inputVolumeSlider || !this.#outputVolumeSlider) return;
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!soundVolumeControl) return;
        const inputVolume = soundVolumeControl.inputVolume;
        const outputVolume = soundVolumeControl.outputVolume;
        this.#isSyncing = true;
        this.#inputVolumeSlider.slider.value = inputVolume;
        this.#outputVolumeSlider.slider.value = outputVolume;
        this.#inputVolumeSlider.icon = SoundVolumeIcon(inputVolume, true);
        this.#outputVolumeSlider.icon = SoundVolumeIcon(outputVolume);
        this.#isSyncing = false;
    }

    #destroy() {
        this.#appButton = null;
        this.#inputVolumeSlider = null;
        this.#outputVolumeSlider = null;
    }

}

class CurrentWorkspaceSection extends PopupMenuSection {

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {Meta.Window[]?} */
    #windows = null;

    /** @type {PopupSeparatorMenuItem?} */
    #title = null;

    /** @type {Map<number, PopupMenuItem?>?} */
    #actions = new Map();

    /** @type {PopupBaseMenuItem?} */
    #minimizeAllItem = null;

    /** @param {Meta.Window[]} windows */
    set windows(windows) {
        if (!this.actor) return;
        this.#windows = windows?.length ? windows : null;
        this.actor.visible = !!this.#windows;
        if (this.#windows) this.#update();
    }

    /** @param {boolean} value */
    set isTitleVisible(value) {
        if (!this.#title?.label || typeof value !== 'boolean') return;
        this.#title.label.visible = value;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super();
        this.#appButton = appButton;
        this.actor.hide();
        this.actor.connect(Event.Destroy, () => this.#destroy());
        /** @type {*} */
        const params = Label.CurrentWorkspace;
        this.#title = new PopupSeparatorMenuItem(params);
        this.addMenuItem(this.#title);
        this.#minimizeAllItem = this.addAction(Label.MinimizeAll, () => appButton.windows?.minimize());
        this.addAction(Label.RaiseAll, () => appButton.windows?.raise());
        this.addAction(Label.CloseAll, () => appButton.windows?.close(true));
    }

    #destroy() {
        this.#actions?.clear();
        this.#actions = null;
        this.#windows = null;
        this.#title = null;
        this.#minimizeAllItem = null;
        this.#appButton = null;
    }

    #update() {
        if (!this.#appButton || !this.#actions ||
            !this.#minimizeAllItem || !this.#windows) return;
        this.#minimizeAllItem.visible = !!this.#windows.find(window => !window.minimized);
        if (this.#actions.size) {
            const menuItems = this.#actions.values();
            for (const menuItem of menuItems) menuItem?.destroy();
            this.#actions.clear();
        }
        const monitors = Context.monitors;
        if (!monitors.hasMultipleMonitors) return;
        const currentMonitor = monitors.getMonitorIndex(this.#appButton.rect);
        const ignoredMonitors = new Set();
        for (const window of this.#windows) {
            const windowMonitor = window.get_monitor();
            if (windowMonitor < 0) continue;
            ignoredMonitors.add(windowMonitor);
        }
        if (ignoredMonitors.size > 1) ignoredMonitors.clear();
        for (const monitor in MonitorDirection) {
            const direction = MonitorDirection[monitor];
            const index = direction === MonitorDirection.CurrentMonitor ? currentMonitor :
                          monitors.getMonitorIndex(direction, currentMonitor);
            if (index < 0 || ignoredMonitors.has(index)) continue;
            const actionLabel = `${Label.MoveTo} ${Label[monitor]}`;
            this.#actions.set(index, this.addAction(actionLabel, () => this.#moveToMonitor(index)));
        }
    }

    /**
     * @param {number} monitorIndex
     */
    #moveToMonitor(monitorIndex) {
        if (!this.#windows?.length) return;
        for (const window of this.#windows) window.move_to_monitor(monitorIndex);
    }

}

class OtherWorkspacesSection extends PopupMenuSection {

    /** @param {boolean} value */
    set isVisible(value) {
        if (!this.actor) return;
        this.actor.visible = value;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super();
        this.actor.hide();
        /** @type {*} */
        const params = Label.OtherWorkspaces;
        this.addMenuItem(new PopupSeparatorMenuItem(params));
        this.addAction(Label.FindWindow, () => appButton?.activate(ActivationBehavior.FindWindow));
        this.addAction(Label.MoveWindows, () => appButton?.activate(ActivationBehavior.MoveWindows));
    }

}

export class Menu extends AppMenu {

    /** @type {SharedConfig?} */
    static #sharedConfig = null;

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {boolean} */
    #hasValidAppId = true;

    /** @type {CurrentWorkspaceSection?} */
    #currentWorkspaceSection = null;

    /** @type {OtherWorkspacesSection?} */
    #otherWorkspacesSection = null;

    /** @type {SoundVolumeControlGroup?} */
    #soundVolumeControlGroup = null;

    /** @type {WindowProxy[]?} */
    #windows = null;

    /** @type {Config?} */
    #config = this.#configProvider.get(this, settingsKey => this.#handleConfig(settingsKey));

    /** @type {SharedConfig} */
    get #configProvider() {
        Menu.#sharedConfig ??= new SharedConfig(ConfigField, ConfigOptions);
        return Menu.#sharedConfig;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton.actor, St.Side.TOP, DefaultProps);
        this.#appButton = appButton;
        this.actor.remove_style_class_name(UNWANTED_STYLE_CLASS);
        this.actor.add_style_class_name(STYLE_CLASS);
        const app = appButton?.app;
        this.#hasValidAppId = app?.id ? !!this._appSystem?.lookup_app(app.id) : false;
        this.#createMenuItems();
        this.#destroySeparator(this._detailsItem);
        if (app) this.setApp(app);
        this._app?.disconnectObject(this);
        this._updateDetailsVisibility();
        const monitorManager = global.backend.get_monitor_manager();
        Context.signals.add(this, [monitorManager, Event.MonitorsChanged, () => this.close()]);
    }

    /**
     * Note: There is a bug in the AppMenu that leads to exceptions while destroying the menu.
     *       Set this._app as null to avoid the exceptions.
     *
     * @override
     */
    destroy() {
        Context.signals.removeAll(this);
        this.close();
        this._app = null;
        this.#appButton = null;
        this.#currentWorkspaceSection = null;
        this.#otherWorkspacesSection = null;
        this.#soundVolumeControlGroup = null;
        this.#config = null;
        super.destroy();
        if (!Menu.#sharedConfig?.destroy(this)) return;
        Menu.#sharedConfig = null;
    }

    /**
     * @override
     * @param {PopupMenuTransitionParams} [params]
     */
    open(params) {
        if (!this.#appButton) return;
        this.rerender();
        super.open(params);
    }

    /**
     * @override
     * @param {PopupMenuTransitionParams} [params]
     */
    close(params) {
        super.close(params);
        this.#clearWindows();
    }

    rerender() {
        if (!this._app) return;
        this.#soundVolumeControlGroup?.update();
        this.#handleWindows();
        this.#updateSeparators();
    }

    #createMenuItems() {
        this.#soundVolumeControlGroup = new SoundVolumeControlGroup(this.#appButton);
        this.addMenuItem(this.#soundVolumeControlGroup.actor);
        if (this.#hasValidAppId) {
            this.addAction(Label.Customize, () => {
                const appId = this._app?.id ?? this.#appButton?.app?.id;
                if (!appId) return;
                this.close();
                Context.navigationApi.navigate(PreferencesPage.TaskbarAppConfig, { appId });
            });
        }
        this.addMenuItem(new PopupSeparatorMenuItem());
        this.moveMenuItem(this._quitItem, this.numMenuItems);
        if (!this.#appButton) return;
        this.#currentWorkspaceSection = new CurrentWorkspaceSection(this.#appButton);
        this.#addSection(this.#currentWorkspaceSection, this._windowSection);
        if (!this.#hasValidAppId) return;
        this.#otherWorkspacesSection = new OtherWorkspacesSection(this.#appButton);
        this.#addSection(this.#otherWorkspacesSection, this._actionSection);
    }

    /**
     * @param {PopupMenuSection} section
     * @param {PopupMenuSection} [sibling]
     */
    #addSection(section, sibling) {
        if (!section) return;
        this.addMenuItem(section);
        if (!sibling) return;
        this.box.set_child_above_sibling(section.actor, sibling.actor);
    }

    /**
     * @param {PopupBaseMenuItem} menuItem
     */
    #destroySeparator(menuItem) {
        const menuItems = this.box.get_children();
        const itemIndex = menuItems.indexOf(menuItem?.actor);
        if (itemIndex < 0) return;
        const detailsSeparator = menuItems[itemIndex - 1];
        if (detailsSeparator instanceof PopupSeparatorMenuItem === false) return;
        detailsSeparator.destroy();
    }

    #updateSeparators() {
        if (!this.isOpen) return;
        this.emit(Event.OpenStateChanged, true);
    }

    #handleWindows() {
        if (!this._app || !this.#appButton ||
            !this.#config || !this._windowSection) return;
        this.#clearWindows();
        this._windowSection.removeAll();
        const { isolateWorkspaces } = this.#config;
        const appName = this._app.get_name();
        const appWindows = this._app.get_windows();
        const currentWorkspace = global.workspace_manager.get_active_workspace();
        const taskbarWindows = this.#appButton.windows?.list;
        const workspaceWindows = [];
        for (const window of appWindows) {
            if (window.get_workspace() === currentWorkspace) workspaceWindows.push(window);
            if (!taskbarWindows?.has(window)) continue;
            const proxy = new WindowProxy(window, appName);
            this.#windows ??= [];
            this.#windows.push(proxy);
            const menuItem = this._windowSection.addAction(proxy.title, () => proxy.activate());
            proxy.connect(Event.TitleChanged, () => menuItem.label?.set_text(proxy.title));
        }
        this._openWindowsHeader.visible = !!this.#windows?.length;
        if (this.#currentWorkspaceSection) {
            this.#currentWorkspaceSection.isTitleVisible = !isolateWorkspaces;
            this.#currentWorkspaceSection.windows = workspaceWindows;
        }
        if (this.#otherWorkspacesSection) {
            const isSectionVisible = isolateWorkspaces && !!appWindows.length && !workspaceWindows.length;
            this.#otherWorkspacesSection.isVisible = isSectionVisible;
        }
    }

    #clearWindows() {
        if (!this.#windows?.length) return;
        for (const window of this.#windows) window.destroy();
        this.#windows = null;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            case ConfigField.showFavorites:
                this._updateFavoriteItem();
                break;
        }
    }

    /**
     * @override
     * @param {Clutter.Actor} [actor] Deprecated since GNOME 51.
     * @param {Clutter.Event} [event] Deprecated since GNOME 51.
     * @returns {boolean}
     */
    _onKeyPress(/** @deprecated */actor, /** @deprecated */event) {
        const [, keySymbol] = this._keyController?.get_key() ?? [];
        const symbol = keySymbol ?? event?.get_key_symbol();
        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return) return Clutter.EVENT_PROPAGATE;
        return super._onKeyPress(actor, event);
    }

    /**
     * @override
     */
    _updateFavoriteItem() {
        super._updateFavoriteItem();
        if (!this._toggleFavoriteItem?.visible) return;
        if (!this.#config?.showFavorites) return this._toggleFavoriteItem.hide();
        const isFavorite = this._appFavorites?.isFavorite(this._app?.id);
        if (isFavorite) return;
        this._toggleFavoriteItem?.label?.set_text(Label.Pin);
    }

    /**
     * Note: Replaced by `#handleWindows` function.
     *
     * @override
     */
    _queueUpdateWindowsSection() {}

    /**
     * Note: Replaced by `#handleWindows` function.
     *
     * @override
     */
    _updateWindowsSection() {}

    /**
     * @override
     */
    _updateNewWindowItem() {
        super._updateNewWindowItem();
        this.#updateSeparators();
    }

    /**
     * @override
     */
    _updateDetailsVisibility() {
        if (!this._app || !this._detailsItem) return;
        const appInfo = this._app.get_app_info();
        const isValidApp = this.#hasValidAppId && appInfo && !appInfo.get_nodisplay();
        if (isValidApp) super._updateDetailsVisibility();
        else this._detailsItem.hide();
    }

    /**
     * @override
     */
    _animateLaunch() {
        this.#appButton?.animateLaunch();
    }

    /**
     * @override
     * @param {PopupBaseMenuItem} menuItem
     */
    _updateSeparatorVisibility(menuItem) {
        if (!this._app || !this.isOpen) return;
        super._updateSeparatorVisibility(menuItem);
    }

}
