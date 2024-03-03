/**
 * JSDoc types
 *
 * @typedef {import('./appButton.js').AppButton} AppButton
 * @typedef {import('../../utils/config.js').Config} Config
 */

import St from 'gi://St';
import { Tooltip as BaseTooltip } from '../base/tooltip.js';
import { ComponentEvent } from '../base/component.js';
import { SharedConfig } from '../../utils/config.js';

const MODULE_NAME = 'Rocketbar__Taskbar_Tooltip';
const CONFIG_PATH = 'taskbar';
const LAYOUT_STYLE_CLASS = 'rocketbar__tooltip_info-layout';
const WINDOW_TITLE_STYLE_CLASS = 'rocketbar__tooltip_window-title';

/** @enum {string} */
const ConfigFields = {
    showDelay: 'tooltip-show-delay',
    hideDelay: 'tooltip-hide-delay',
    shrinkWindowTitles: 'tooltip-shrink-window-titles',
    enableWindowsPreview: 'tooltip-enable-windows-preview'
};

/** @type {{[prop: string]: *}} */
const LayoutProps = {
    style_class: LAYOUT_STYLE_CLASS,
    vertical: true,
    x_expand: true,
    clip_to_allocation: true
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
        this.#appName = new St.Label();
        this.#appName.set_text(appButton?.app?.get_name() ?? '');
        this.#windowTitle = new St.Label(WindowTitleProps);
        this.#layout = new St.BoxLayout(LayoutProps);
        this.#layout.add_child(this.#windowTitle);
        this.#layout.add_child(this.#appName);
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
        this.#rerender();
        super.rerender();
    }

    #destroy() {
        this.#appButton = null;
        this.#layout = null;
        this.#appName = null;
        this.#windowTitle = null;
        this.#config = null;
        this.#events = null;
        if (!Tooltip.#sharedConfig?.destroy(this)) return;
        Tooltip.#sharedConfig = null;
    }

    #handleConfig() {
        if (!this.#config) return;
        const { showDelay, hideDelay } = this.#config;
        this.showDelay = showDelay;
        this.hideDelay = hideDelay;
    }

    #rerender() {
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
