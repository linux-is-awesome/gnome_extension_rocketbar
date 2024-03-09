/**
 * JSDoc types
 *
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../utils/config.js').Config} Config
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import { Tooltip as BaseTooltip } from '../base/tooltip.js';
import { ComponentEvent } from '../base/component.js';
import { SharedConfig } from '../../utils/config.js';
import { Event } from '../../core/enums.js';
import { SoundVolumeIcon, SoundInputIcon, SoundOutputIcon } from '../../utils/soundVolumeIcon.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Tooltip';
const CONFIG_PATH = 'taskbar';
const LAYOUT_STYLE_CLASS = 'rocketbar__tooltip_layout';
const WINDOW_TITLE_STYLE_CLASS = 'rocketbar__tooltip_window-title';
const APP_STATUS_STYLE_CLASS = 'rocketbar__tooltip_app-status';
const APP_STATUS_ITEM_STYLE_CLASS = 'rocketbar__tooltip_app-status_item';

/** @enum {string} */
const AppStatusItemIcon = {
    Windows: 'window-symbolic',
    Notifications: 'notification-symbolic',
    Progress: 'document-open-recent-symbolic',
    SoundOutputVolume: SoundOutputIcon.Muted,
    SoundInputVolume: SoundInputIcon.Muted
};

/** @enum {string} */
const ConfigFields = {
    showDelay: 'tooltip-show-delay',
    hideDelay: 'tooltip-hide-delay',
    shrinkWindowTitles: 'tooltip-shrink-window-titles',
    enableWindowsPreview: 'tooltip-enable-windows-preview'
};

/** @type {{[prop: string]: *}} */
const AppStatusProps = {
    style_class: APP_STATUS_STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const AppStatusItemProps = {
    style_class: APP_STATUS_ITEM_STYLE_CLASS
};

/** @type {{[prop: string]: *}} */
const AppStatusItemValueProps = {
    y_align: Clutter.ActorAlign.CENTER
};

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    style_class: LAYOUT_STYLE_CLASS,
    clip_to_allocation: true,
    vertical: true,
    x_expand: true,
    y_expand: true
};

/** @type {{[prop: string]: *}} */
const WindowTitleProps = {
    style_class: WINDOW_TITLE_STYLE_CLASS
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

class AppStatusItem {

    /** @type {St.BoxLayout?} */
    #actor = null;

    /** @type {St.Icon?} */
    #icon = null;

    /** @type {St.Label?} */
    #value = null;

    /** @type {St.BoxLayout} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#actor;
    }

    /** @param {string?} value */
    set icon(value) {
        const iconName = typeof value === 'string' ? value : null;
        this.#icon?.set_icon_name(iconName);
    }

    /** @param {number} value */
    set value(value) {
        if (typeof value !== 'number') return;
        this.#value?.set_text(`${value}`);
    }

    /**
     * @param {string} [iconName]
     */
    constructor(iconName) {
        this.#actor = new St.BoxLayout(AppStatusItemProps);
        this.#icon = new St.Icon();
        this.#value = new St.Label(AppStatusItemValueProps);
        this.#actor.add_child(this.#icon);
        this.#actor.add_child(this.#value);
        this.#actor.connect(Event.Destroy, () => this.#destroy())
        if (!iconName) return;
        this.icon = iconName;
    }

    #destroy() {
        this.#actor = null;
        this.#icon = null;
        this.#value = null;
    }

}

class AppStatus {

    /** @type {St.BoxLayout?} */
    #actor = new St.BoxLayout();

    /** @type {Map<string, AppStatusItem>?} */
    #items = null;

    /** @type {AppButton?} */
    #appButton = null;

    /** @type {St.BoxLayout} */
    get actor() {
        if (!this.#actor) throw new Error(`${this.constructor.name} is invalid.`);
        return this.#actor;
    }

    /**
     * @param {AppButton} appButton
     */
    constructor(appButton) {
        this.#actor = new St.BoxLayout(AppStatusProps);
        this.#actor.connect(Event.Destroy, () => this.#destroy())
        this.#appButton = appButton;
        this.#items = new Map();
        const items = AppStatusItemIcon;
        for (const icon in items) {
            const iconName = items[icon];
            const statusItem = new AppStatusItem(iconName);
            this.#items.set(iconName, statusItem);
            this.#actor.add_child(statusItem.actor);
        }
    }

    rerender() {
        if (!this.#actor || !this.#items || !this.#appButton) return;
        let isVisible = false;
        for (const [icon, item] of this.#items) {
            if (!this.#updateStatus(icon, item)) continue;
            isVisible = true;
        }
        this.#actor.visible = isVisible;
    }

    /**
     * @param {AppStatusItemIcon} icon
     * @param {AppStatusItem} item
     * @returns {boolean}
     */
    #updateStatus(icon, item) {
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
        const isVisible = value >= 0;
        item.actor.visible = isVisible;
        if (isVisible) {
            item.value = value;
        }
        return isVisible;
    }

    #destroy() {
        this.#items?.clear();
        this.#items = null;
        this.#actor = null;
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
        this.#appName = new St.Label({ text: appButton.app?.get_name() });
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
     */
    rerender() {
        if (this.isHidden) return;
        this.lockSize();
        this.#updateWindowTitle();
        this.#status?.rerender();
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
