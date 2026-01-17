/**
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Component, ComponentEvent } from '../base/component.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';
import { Icon } from '../base/icon.js';
import { Tooltip as BaseTooltip } from '../base/tooltip.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { SoundVolumeIcon, SoundInputIcon, SoundOutputIcon } from '../../utils/soundVolumeIcon.js';
import { WindowProxy } from '../../utils/taskbar/windowProxy.js';
import { Event } from '../../../shared/enums/general.js';
import { TooltipConfigField as ConfigField, ConfigOptions } from '../../../shared/enums/taskbar.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Tooltip';
const LAYOUT_STYLE_CLASS = 'rocketbar__tooltip_layout';
const WINDOW_TITLE_STYLE_CLASS = 'rocketbar__tooltip_window-title';
const APP_STATUS_STYLE_CLASS = 'rocketbar__tooltip_app-status';
const APP_STATUS_ITEM_STYLE_CLASS = 'rocketbar__tooltip_app-status_item';
const SOUND_VOLUME_CHANGE_STEP = 5;

/** @enum {string} */
const AppStatusItemIcon = {
    Windows: 'window-symbolic',
    Notifications: 'notification-symbolic',
    Progress: 'document-open-recent-symbolic',
    SoundOutputVolume: SoundOutputIcon.Muted,
    SoundInputVolume: SoundInputIcon.Muted
};

/** @type {{[prop: string]: *}} */
const AppStatusProps = {
    name: `${MODULE_NAME}-AppStatus`,
    style_class: APP_STATUS_STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const AppStatusItemProps = {
    name: `${AppStatusProps.name}_Item`,
    style_class: APP_STATUS_ITEM_STYLE_CLASS,
    track_hover: true
};

/** @type {{[prop: string]: *}} */
const AppStatusItemValueProps = {
    name: `${AppStatusItemProps.name}-Value`,
    y_align: Clutter.ActorAlign.CENTER
};

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    name: `${MODULE_NAME}-Layout`,
    style_class: LAYOUT_STYLE_CLASS,
    clip_to_allocation: true,
    vertical: true,
    x_expand: true,
    y_expand: true
};

/** @type {{[prop: string]: *}} */
const WindowTitleProps = {
    name: `${MODULE_NAME}-WindowTitle`,
    style_class: WINDOW_TITLE_STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const AppNameProps = {
    name: `${MODULE_NAME}-AppName`
};

class AppStatusItem extends Icon {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {St.BoxLayout?} */
    #actor = null;

    /** @type {St.Label?} */
    #value = null;

    /**
     * @param {string} name
     * @param {boolean} [reactive]
     */
    constructor(name, reactive = false) {
        super(name, `${AppStatusItemProps.name}-Icon`);
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        this.#value = new St.Label(AppStatusItemValueProps);
        this.#actor = new St.BoxLayout({ ...AppStatusItemProps, reactive });
        this.#actor.add_child(super.actor);
        this.#actor.add_child(this.#value);
        this.#actor.set_pivot_point(0.5, 0.5);
        if (!reactive) return;
        const clickAction = new Clutter.ClickAction();
        clickAction.connect(Event.Clicked, event => this.notifyParents(Event.Clicked, { name, event }));
        this.#actor.add_action(clickAction);
        this.#actor.connect(Event.Scroll, (_, event) => this.notifyParents(Event.Scroll, { name, event }));
    }

    /**
     * @param {number} value
     * @param {boolean} [allowAnimation]
     * @returns {boolean}
     */
    update(value, allowAnimation = false) {
        if (!this.#actor) return false;
        const isVisible = this.#actor.visible;
        const visible = typeof value === 'number' && value >= 0;
        if (visible) this.#value?.set_text(`${value}`);
        if (visible === isVisible) return visible;
        if (!visible) {
            this.#actor.remove_all_transitions();
            this.#actor.hide();
            return visible;
        }
        const animationParams = { ...AnimationType.OpacityMax, ...AnimationType.ScaleNormal };
        const props = allowAnimation ? { ...AnimationType.OpacityMin, ...AnimationType.ScaleMin } : animationParams;
        this.#actor.set({ ...props, visible });
        if (allowAnimation) Animation(this.#actor, AnimationDuration.Slow, animationParams);
        return visible;
    }

    /**
     * @override
     * @param {AppStatus} parent
     * @returns {this}
     */
    setParent(parent) {
        if (parent instanceof AppStatus === false || !this.#actor) return this;
        parent.actor.add_child(this.#actor);
        this.#actor._delegate = parent;
        return this;
    }

    #destroy() {
        this.#value = null;
        this.#events = null;
        if (!this.#actor) return;
        this.#actor._delegate = null;
        this.#actor = null;
    }

}

/**
 * @augments Component<St.BoxLayout>
 */
class AppStatus extends Component {

    /** @type {{[event: string]: (...args) => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [Event.Clicked]: params => (this.#handleItemClick(params), true),
        [Event.Scroll]: params => (this.#handleItemScroll(params), true)
    };

    /** @type {Map<string, AppStatusItem>?} */
    #items = null;

    /** @type {AppButton?} */
    #appButton = null;

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(new St.BoxLayout(AppStatusProps));
        super.notifyCallback = data => this.#events?.[data?.event]?.(data?.params);
        this.#appButton = appButton;
        this.#items = new Map();
        for (const icon in AppStatusItemIcon) {
            const iconName = AppStatusItemIcon[icon];
            const isReactive = iconName === AppStatusItemIcon.SoundInputVolume ||
                               iconName === AppStatusItemIcon.SoundOutputVolume;
            const statusItem = new AppStatusItem(iconName, isReactive);
            this.#items.set(iconName, statusItem);
            statusItem.setParent(this);
        }
    }

    /**
     * @param {boolean} allowAnimation
     */
    rerender(allowAnimation) {
        if (!this.#items || !this.#appButton || !this.isValid) return;
        let visible = false;
        for (const [icon, item] of this.#items) {
            if (!this.#updateStatus(icon, item, allowAnimation)) continue;
            visible = true;
        }
        this.setProps({ visible });
    }

    #destroy() {
        this.#items?.clear();
        this.#items = null;
        this.#appButton = null;
    }

    /**
     * @param {{name: string, event: Clutter.Event}} params
     */
    #handleItemClick(params) {
        const { name } = params ?? {};
        const item = this.#items?.get(name);
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!item) return;
        switch (name) {
            case AppStatusItemIcon.SoundInputVolume:
            case AppStatusItemIcon.SoundOutputVolume:
                const isInput = name === AppStatusItemIcon.SoundInputVolume;
                const callback = () => this.#updateStatus(name, item);
                if (isInput) soundVolumeControl?.toggleInputMute(callback);
                else soundVolumeControl?.toggleOutputMute(callback);
                break;
        }
    }

    /**
     * @param {{name: string, event: Clutter.Event}} params
     */
    #handleItemScroll(params) {
        const { name, event } = params ?? {};
        if (!name || !event) return;
        const item = this.#items?.get(name);
        const scrollDirection = event.get_scroll_direction();
        if (!item || scrollDirection === Clutter.ScrollDirection.SMOOTH) return;
        switch (name) {
            case AppStatusItemIcon.SoundInputVolume:
            case AppStatusItemIcon.SoundOutputVolume:
                const soundVolumeControl = this.#appButton?.soundVolumeControl;
                const step = scrollDirection === Clutter.ScrollDirection.DOWN ||
                             scrollDirection === Clutter.ScrollDirection.LEFT ?
                             -SOUND_VOLUME_CHANGE_STEP : SOUND_VOLUME_CHANGE_STEP;
                const isInput = name === AppStatusItemIcon.SoundInputVolume;
                if (isInput) soundVolumeControl?.addInputVolume(step);
                else soundVolumeControl?.addOutputVolume(step);
                break;
            default: return;
        }
        this.#updateStatus(name, item);
    }

    /**
     * @param {AppStatusItemIcon} icon
     * @param {AppStatusItem} item
     * @param {boolean} [allowAnimation]
     * @returns {boolean}
     */
    #updateStatus(icon, item, allowAnimation = false) {
        if (!this.isValid) return false;
        let value = -1;
        switch (icon) {
            case AppStatusItemIcon.Windows:
                const windowCount = this.#appButton?.windows?.size ?? 0;
                value = windowCount > 1 ? windowCount : value;
                break;
            case AppStatusItemIcon.Notifications:
                const notificationsCount = this.#appButton?.notificationsCount;
                value = notificationsCount ? notificationsCount : value;
                break;
            case AppStatusItemIcon.Progress:
                const progress = this.#appButton?.progress;
                value = progress ? Math.round(progress * 100) : value;
                break;
            case AppStatusItemIcon.SoundInputVolume: {
                const soundVolumeControl = this.#appButton?.soundVolumeControl;
                const hasInput = !!soundVolumeControl?.hasInput;
                if (!hasInput) break;
                const inputValue = soundVolumeControl.inputVolume;
                item.iconPath = SoundVolumeIcon(inputValue, true);
                value = Math.round(inputValue * 100);
                break;
            }
            case AppStatusItemIcon.SoundOutputVolume: {
                const soundVolumeControl = this.#appButton?.soundVolumeControl;
                const hasOutput = !!soundVolumeControl?.hasOutput;
                if (!hasOutput) break;
                const outputValue = soundVolumeControl.outputVolume;
                item.iconPath = SoundVolumeIcon(outputValue);
                value = Math.round(outputValue * 100);
                break;
            }
        }
        return item.update(value, allowAnimation);
    }

}

export class Tooltip extends BaseTooltip {

    /** @type {SharedConfig?} */
    static #sharedConfig = null;

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {Config?} */
    #config = this.#configProvider.get(this, settingsKey => this.#handleConfig(settingsKey));

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {St.BoxLayout?} */
    #layout = null;

    /** @type {St.Label?} */
    #appName = null;

    /** @type {St.Label?} */
    #windowTitle = null;

    /** @type {AppStatus?} */
    #status = null;

    /** @type {WindowProxy?} */
    #activeWindow = null;

    /** @type {SharedConfig} */
    get #configProvider() {
        Tooltip.#sharedConfig ??= new SharedConfig(ConfigField, ConfigOptions);
        return Tooltip.#sharedConfig;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton, MODULE_NAME);
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        super.trackHover = true;
        this.#appButton = appButton;
        this.#layout = new St.BoxLayout(LayoutProps);
        this.#windowTitle = new St.Label(WindowTitleProps);
        this.#appName = new St.Label(AppNameProps);
        this.#appName.set_text(appButton.app?.get_name() ?? null);
        this.#status = new AppStatus(appButton);
        this.#layout.add_child(this.#windowTitle);
        this.#layout.add_child(this.#appName);
        this.#layout.add_child(this.#status.actor);
        this.actor.add_child(this.#layout);
        this.connect(Event.Mapped, () => this.#handleMapped());
        this.#handleConfig();
    }

    /**
     * @override
     * @param {boolean} [hasChanges]
     */
    rerender(hasChanges = false) {
        if (this.isHidden) return;
        const isShown = this.isShown;
        if (isShown && !hasChanges) return;
        this.lockSize();
        this.#handleActiveWindow();
        this.#status?.rerender(isShown);
        super.rerender();
    }

    #destroy() {
        this.#releaseActiveWindow();
        this.#layout = null;
        this.#appName = null;
        this.#windowTitle = null;
        this.#status = null;
        this.#config = null;
        this.#events = null;
        this.#appButton = null;
        if (!Tooltip.#sharedConfig?.destroy(this)) return;
        Tooltip.#sharedConfig = null;
    }

    #handleMapped() {
        if (!this.isHidden) return;
        if (this.#activeWindow) this.#releaseActiveWindow();
    }

    /**
     * @param {string} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (!this.#config) return;
        switch (settingsKey) {
            case ConfigField.shrinkWindowTitles:
                this.#releaseActiveWindow();
                break;
            default:
                const { showDelay, hideDelay, maxLength } = this.#config;
                this.showDelay = showDelay;
                this.hideDelay = hideDelay;
                this.maxLength = maxLength;
        }
    }

    #handleActiveWindow() {
        if (!this.#windowTitle || !this.#appButton || !this.#config) return;
        const activeWindow = this.#appButton.windows?.activeWindow;
        const isActiveWindowChanged = !activeWindow || this.#activeWindow?.source !== activeWindow;
        if (isActiveWindowChanged && this.#activeWindow) this.#releaseActiveWindow();
        if (activeWindow && !this.#activeWindow) {
            const { shrinkWindowTitles } = this.#config;
            const appName = shrinkWindowTitles ? this.#appButton.app?.get_name() : null;
            this.#activeWindow = new WindowProxy(activeWindow, appName);
            this.#activeWindow.connect(Event.TitleChanged, () => this.rerender(true));
        }
        this.#windowTitle.visible = !!this.#activeWindow;
        this.#windowTitle.set_text(this.#activeWindow?.title ?? null);
    }

    #releaseActiveWindow() {
        this.#activeWindow?.destroy();
        this.#activeWindow = null;
    }

}
