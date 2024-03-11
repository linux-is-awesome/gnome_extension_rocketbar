/**
 * JSDoc types
 *
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Component, ComponentEvent } from '../base/component.js';
import { Tooltip as BaseTooltip } from '../base/tooltip.js';
import { SharedConfig } from '../../utils/config.js';
import { SoundVolumeIcon, SoundInputIcon, SoundOutputIcon } from '../../utils/soundVolumeIcon.js';
import { Animation, AnimationType, AnimationDuration } from '../base/animation.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Tooltip';
const CONFIG_PATH = 'taskbar';
const LAYOUT_STYLE_CLASS = 'rocketbar__tooltip_layout';
const WINDOW_TITLE_STYLE_CLASS = 'rocketbar__tooltip_window-title';
const APP_STATUS_STYLE_CLASS = 'rocketbar__tooltip_app-status';
const APP_STATUS_ITEM_STYLE_CLASS = 'rocketbar__tooltip_app-status_item';

/** @enum {string} */
const ConfigFields = {
    showDelay: 'tooltip-show-delay',
    hideDelay: 'tooltip-hide-delay',
    shrinkWindowTitles: 'tooltip-shrink-window-titles',
    enableWindowsPreview: 'tooltip-enable-windows-preview'
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
const AppStatusItemIconProps = {
    name: `${AppStatusItemProps.name}-Icon`
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
    if (!title || !appName) return title ?? null;
    const endRegExp = new RegExp(` -(?=[^-]*$).*${appName}$`);
    if (title.match(endRegExp)) {
        title = title.replace(endRegExp, '');
    } else {
        title = title.replace(new RegExp(`^${appName} - `), '');
    }
    return title;
};

/**
 * @augments Component<St.BoxLayout>
 */
class AppStatusItem extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {St.Icon?} */
    #icon = null;

    /** @type {St.Label?} */
    #value = null;

    /** @param {string?} value */
    set icon(value) {
        const iconName = typeof value === 'string' ? value : null;
        this.#icon?.set_icon_name(iconName);
    }

    /**
     * @param {string} iconName
     * @param {boolean} [reactive]
     */
    constructor(iconName, reactive = false) {
        const props = { ...AppStatusItemProps, reactive };
        super(new St.BoxLayout(props));
        this.#icon = new St.Icon(AppStatusItemIconProps);
        this.#value = new St.Label(AppStatusItemValueProps);
        const actor = this.actor;
        actor.add_child(this.#icon);
        actor.add_child(this.#value);
        actor.set_pivot_point(0.5, 0.5);
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
        if (!iconName) return;
        this.icon = iconName;
    }

    /**
     * @param {number} value
     * @param {boolean} allowAnimation
     * @returns {boolean}
     */
    update(value, allowAnimation) {
        const actor = this.actor;
        const isVisible = actor.visible; 
        const visible = typeof value === 'number' && value >= 0;
        if (visible) this.#value?.set_text(`${value}`);
        if (visible === isVisible) return visible;
        if (!visible) {
            actor.remove_all_transitions();
            actor.hide();
            return visible;
        }
        const animationParams = { ...AnimationType.OpacityMax, ...AnimationType.ScaleNormal };
        const props = allowAnimation ? { ...AnimationType.OpacityMin, ...AnimationType.ScaleMin } : animationParams;
        this.setProps({ ...props, visible });
        if (allowAnimation) Animation(this, AnimationDuration.Slow, animationParams);
        return visible;
    }

    #destroy() {
        this.#icon = null;
        this.#value = null;
    }

}

/**
 * @augments Component<St.BoxLayout>
 */
class AppStatus extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
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
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
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

    /**
     * @param {AppStatusItemIcon} icon
     * @param {AppStatusItem} item
     * @param {boolean} allowAnimation
     * @returns {boolean}
     */
    #updateStatus(icon, item, allowAnimation) {
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
                item.icon = SoundVolumeIcon(inputValue, true);
                value = Math.round(inputValue * 100);
                break;
            }
            case AppStatusItemIcon.SoundOutputVolume: {
                const soundVolumeControl = this.#appButton?.soundVolumeControl;
                const hasOutput = !!soundVolumeControl?.hasOutput;
                if (!hasOutput) break;
                const outputValue = soundVolumeControl.outputVolume;
                item.icon = SoundVolumeIcon(outputValue);
                value = Math.round(outputValue * 100);
                break;
            }
        }
        return item.update(value, allowAnimation);
    }

    #destroy() {
        this.#items?.clear();
        this.#items = null;
        this.#appButton = null;
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
        if (!appButton) return;
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
