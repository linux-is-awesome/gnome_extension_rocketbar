/**
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../../shared/utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Event } from '../../../shared/core/enums.js';
import { Component, ComponentEvent } from '../base/component.js';
import { Icon } from '../base/icon.js';
import { Tooltip as BaseTooltip } from '../base/tooltip.js';
import { SharedConfig } from '../../../shared/utils/config.js';
import { SoundVolumeIcon, SoundInputIcon, SoundOutputIcon } from '../../utils/soundVolumeIcon.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Tooltip';
const CONFIG_PATH = 'taskbar';
const LAYOUT_STYLE_CLASS = 'rocketbar__tooltip_layout';
const WINDOW_TITLE_STYLE_CLASS = 'rocketbar__tooltip_window-title';
const APP_STATUS_STYLE_CLASS = 'rocketbar__tooltip_app-status';
const APP_STATUS_ITEM_STYLE_CLASS = 'rocketbar__tooltip_app-status_item';
const SOUND_VOLUME_CHANGE_STEP = 5;

/** @enum {string} */
const ConfigFields = {
    showDelay: 'tooltip-show-delay',
    hideDelay: 'tooltip-hide-delay',
    shrinkWindowTitles: 'tooltip-shrink-window-titles',
    enableWindowPreviews: 'tooltip-enable-window-previews'
};

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

/**
 * @param {string?} title
 * @param {string?} [appName]
 * @returns {string?}
 */
const WindowTitleText = (title, appName) => {
    if (!title || !appName) return title || null;
    const endRegExp = new RegExp(` [-—](?=[^-]*$).*${appName}$`);
    if (endRegExp.test(title)) {
        return title.replace(endRegExp, '') || title;
    }
    return title.replace(new RegExp(`^${appName} - `), '') || title;
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
        this.#value = new St.Label(AppStatusItemValueProps);
        this.#actor = new St.BoxLayout({ ...AppStatusItemProps, reactive });
        this.#actor.add_child(super.actor);
        this.#actor.add_child(this.#value);
        this.#actor.set_pivot_point(0.5, 0.5);
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
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
        if (parent && this.#actor) parent.actor.add_child(this.#actor);
        return this;
    }

    #destroy() {
        this.#actor = null;
        this.#value = null;
        this.#events = null;
    }

}

/**
 * @augments Component<St.BoxLayout>
 */
class AppStatus extends Component {

    /** @type {{[event: string]: (...args) => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [Event.Clicked]: params => this.#handleItemClick(params),
        [Event.Scroll]: params => this.#handleItemScroll(params)
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
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.(data?.params));
        this.#appButton = appButton;
        this.#items = new Map();
        const items = AppStatusItemIcon;
        for (const icon in items) {
            const iconName = items[icon];
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
     * @returns {boolean}
     */
    #handleItemClick(params) {
        const { name } = params ?? {};
        const item = this.#items?.get(name);
        const soundVolumeControl = this.#appButton?.soundVolumeControl;
        if (!item) return true;
        switch (name) {
            case AppStatusItemIcon.SoundInputVolume:
            case AppStatusItemIcon.SoundOutputVolume:
                const isInput = name === AppStatusItemIcon.SoundInputVolume;
                const callback = () => this.#updateStatus(name, item);
                if (isInput) soundVolumeControl?.toggleInputMute(callback);
                else soundVolumeControl?.toggleOutputMute(callback);
                break;
        }
        return true;
    }

    /**
     * @param {{name: string, event: Clutter.Event}} params
     * @returns {boolean}
     */
    #handleItemScroll(params) {
        const { name, event } = params ?? {};
        if (!name || !event) return true;
        const item = this.#items?.get(name);
        const scrollDirection = event.get_scroll_direction();
        if (!item || scrollDirection === Clutter.ScrollDirection.SMOOTH) return true;
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
            default: return true;
        }
        this.#updateStatus(name, item);
        return true;
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
                const windowsCount = this.#appButton?.windowsCount ?? 0;
                value = windowsCount > 1 ? windowsCount : value;
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
    #config = this.#configProvider.getConfig(this, () => this.#handleConfig());

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

    /** @type {SharedConfig} */
    get #configProvider() {
        Tooltip.#sharedConfig ??= new SharedConfig(ConfigFields, { path: CONFIG_PATH });
        return Tooltip.#sharedConfig;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        super(appButton, MODULE_NAME);
        this.trackHover = true;
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
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
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
        this.#updateWindowTitle();
        this.#status?.rerender(isShown);
        super.rerender();
    }

    #destroy() {
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

    #handleConfig() {
        if (!this.#config) return;
        const { showDelay, hideDelay } = this.#config;
        this.showDelay = showDelay;
        this.hideDelay = hideDelay;
    }

    #updateWindowTitle() {
        if (!this.#windowTitle || !this.#appButton || !this.#config) return;
        let text = null;
        const { shrinkWindowTitles } = this.#config;
        const windows = this.#appButton.windows;
        const appWindows = this.#appButton.app?.get_windows();
        const appName = shrinkWindowTitles ? this.#appButton.app?.get_name() : null;
        if (windows?.size && appWindows?.length) {
            for (const window of appWindows) {
                if (!windows.has(window)) continue;
                text = WindowTitleText(window.get_title(), appName);
                break;
            }
        }
        const visible = !!text;
        this.#windowTitle.set({ text, visible });
    }

}
