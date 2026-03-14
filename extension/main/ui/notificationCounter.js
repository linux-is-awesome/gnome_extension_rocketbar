/**
 * @typedef {import('resource:///org/gnome/shell/ui/dateMenu.js').DateMenuButton} DateMenuButton
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Context from '../core/context.js';
import { MainPanel } from '../core/shell.js';
import { Component, ComponentEvent } from './base/component.js';
import { Animation, AnimationDuration, AnimationType } from './base/animation.js';
import { NotificationHandler } from '../services/notifications.js';
import { Config } from '../../shared/utils/config.js';
import { Event, Delay, Property } from '../../shared/enums/general.js';
import { ConfigOptions, ConfigField } from '../../shared/enums/notificationCounter.js';

const MODULE_NAME = 'Rocketbar__NotificationCounter';
const DND_SETTINGS_KEY = 'show-banners';
const CLOCK_DISPLAY_POSITION = 1;
const DATE_MENU_STYLE_CLASS = 'rocketbar__date-menu';
const COUNTER_STYLE_CLASS = 'rocketbar__notification-counter';
const COUNTER_STYLE_PSEUDO_CLASS = 'transition';
const COUNTER_EMPTY_COLOR = 'transparent';
const COUNTER_EMPTY_BORDER_SIZE = 2;
const COUNTER_LONG_VALUE_PADDING = 3;
const COUNTER_DEFAULT_TEXT = '0';

/** @enum {string} */
const DateMenuEvent = {
    DndChanged: 'datemenu::dnd-changed'
};

/** @type {{[prop: string]: *}} */
const CounterProps = {
    name: `${MODULE_NAME}-Counter`,
    style_class: COUNTER_STYLE_CLASS,
    text: COUNTER_DEFAULT_TEXT,
    visible: false,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER,
    ...AnimationType.OpacityMin
};

/** @type {{[prop: string]: *}} */
const SpacerProps = {
    name: `${MODULE_NAME}-Spacer`,
    text: COUNTER_DEFAULT_TEXT,
    y_align: Clutter.ActorAlign.CENTER,
    ...AnimationType.OpacityMin
};

/**
 * @augments Component<St.BoxLayout>
 */
class DateMenu extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {DateMenuButton?} */
    #dateMenu = MainPanel.statusArea?.dateMenu;

    /** @type {string?} */
    #clockDisplayStyleClass = null;

    /** @type {St.BoxLayout?} */
    get #container() {
        const result = this.#dateMenu?.get_children()[0];
        return result instanceof St.BoxLayout ? result : null;
    }

    /** @type {boolean} */
    get isDndEnabled() {
        return this.#dateMenu?._indicator?._settings?.get_boolean(DND_SETTINGS_KEY) === false;
    }

    constructor() {
        super(new St.BoxLayout({ name: `${MODULE_NAME}-${DateMenu.name}` }));
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        this.#initialize();
    }

    #initialize() {
        if (!this.#dateMenu?._clockDisplay) return;
        this.#clockDisplayStyleClass = this.#dateMenu._clockDisplay.get_style_class_name();
        this.actor.set_style_class_name(this.#clockDisplayStyleClass);
        this.#dateMenu._indicator?.hide();
        this.#dateMenu._clockDisplay.set_style_class_name(null);
        this.#dateMenu.add_style_class_name(DATE_MENU_STYLE_CLASS);
        this.#addSignals();
        this.#setParent();
    }

    #addSignals() {
        const target = this.#dateMenu?._indicator;
        if (!target) return;
        Context.signals.add(this,
            [target, Event.VisibleChanged, indicator => indicator?.hide()],
            [target._settings, `${Event.Changed}::${DND_SETTINGS_KEY}`, () => this.notifyChildren(DateMenuEvent.DndChanged)]);
    }

    #setParent() {
        const container = this.#container;
        if (!container || !this.#dateMenu?._clockDisplay) return;
        const clockDisplayParent = this.#dateMenu._clockDisplay.get_parent();
        if (clockDisplayParent && clockDisplayParent !== container) return;
        if (clockDisplayParent) container.remove_child(this.#dateMenu._clockDisplay);
        this.actor.add_child(this.#dateMenu._clockDisplay);
        this.setParent(container, CLOCK_DISPLAY_POSITION);
    }

    #destroy() {
        Context.signals.removeAll(this);
        this.actor.remove_all_children();
        if (!this.#dateMenu) return;
        this.#dateMenu.remove_style_class_name(DATE_MENU_STYLE_CLASS);
        this.#dateMenu._clockDisplay?.set_style_class_name(this.#clockDisplayStyleClass);
        this.#dateMenu._indicator?._sync();
        if (this.#dateMenu._clockDisplay && !this.#dateMenu._clockDisplay.get_parent()) {
            this.#container?.insert_child_at_index(this.#dateMenu._clockDisplay, CLOCK_DISPLAY_POSITION);
        }
        this.#dateMenu = null;
        this.#events = null;
    }

}

/**
 * @augments Component<St.BoxLayout>
 */
export default class NotificationCounter extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy(),
        [ComponentEvent.Init]: () => Context.jobs.shared(this, () => this.#rerender(), Delay.Background),
        [DateMenuEvent.DndChanged]: () => (this.#config?.colorsDnd && this.#updateStyle(), true)
    };

    /** @type {St.Label?} */
    #counter = null;

    /** @type {number} */
    #count = 0;

    /** @type {number} */
    #totalCount = 0;

    /** @type {boolean} */
    #isUpdated = false;

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    /** @type {DateMenu?} */
    #dateMenu = new DateMenu();

    /** @type {NotificationHandler} */
    #notificationHandler = new NotificationHandler(count => this.#setCount(count));

    /** @type {boolean} */
    get #isVisible() {
        return this.#count > 0 || !this.#config?.hideEmpty;
    }

    constructor() {
        super(new St.BoxLayout({ name: MODULE_NAME }));
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        this.#createCounter();
        this.connect(Event.Mapped, () => this.#handleMapped());
        const desktop = Context.desktop;
        desktop.connectInit(this, () => super.setParent(this.#dateMenu))
               .connectScale(this, () => this.#rerender());
        Context.signals.add(this, [desktop.settings, Event.FontNameChanged, () => this.#rerender()]);
    }

    /**
     * Note: This component doesn't support changing the parent.
     *
     * @override
     * @returns {this}
     */
    setParent() {
        return this;
    }

    #destroy() {
        Context.jobs.removeAll(this);
        Context.desktop.disconnect(this);
        Context.signals.removeAll(this);
        this.#counter?.remove_all_transitions();
        this.#dateMenu?.destroy();
        this.#notificationHandler?.destroy();
        this.#counter = null;
        this.#dateMenu = null;
        this.#events = null;
        this.#config = null;
    }

    #createCounter() {
        const spacer = new St.Label(SpacerProps);
        this.#counter = new St.Label(CounterProps);
        this.#counter.set_pivot_point(0.5, 0.5);
        this.#counter.bind_property(Property.Visible, spacer, Property.Visible, GObject.BindingFlags.SYNC_CREATE);
        this.actor.add_child(spacer);
        this.actor.add_child(this.#counter);
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        if (!this.#counter) return;
        switch (settingsKey) {
            case ConfigField.hideEmpty:
                if (this.#isVisible) {
                    if (!this.#counter.visible) this.#rerender();
                    return;
                }
                this.#counter.hide();
            case ConfigField.centerClock:
                this.#updateClockMargin();
                break;
            case ConfigField.maxCount:
                this.#setCount(this.#totalCount);
                break;
            case ConfigField.fontSize:
                this.#updateStyle();
                this.#updateClockMargin();
                break;
            default: this.#updateStyle();
        }
    }

    #handleMapped() {
        const isMapped = this.isMapped;
        if (isMapped && !this.#isUpdated) return;
        this.#isUpdated = false;
        if (!isMapped) return;
        this.#rerender();
    }

    /**
     * @param {number} count
     */
    #setCount(count) {
        if (!this.isValid || !this.#config) return;
        const { maxCount } = this.#config;
        this.#totalCount = count;
        count = Math.min(count, maxCount);
        if (this.#count === count) return;
        this.#count = count;
        this.#rerender();
    }

    async #rerender() {
        if (!this.#counter || !this.hasAllocation ||
            Context.jobs.hasShared(this, Delay.Background)) return;
        const counter = this.#counter;
        const transitionClass = COUNTER_STYLE_PSEUDO_CLASS;
        counter.remove_all_transitions();
        counter.remove_style_pseudo_class(transitionClass);
        const isHidden = await Animation(counter, AnimationDuration.Faster, AnimationType.ScaleMin);
        if (!isHidden || !this.isValid || !this.#counter) return;
        const visible = this.#isVisible;
        const text = `${this.#count}`;
        counter.set({ text, visible });
        this.#updateStyle();
        this.#updateClockMargin();
        if (!visible) return;
        counter.add_style_pseudo_class(transitionClass);
        const animationParams = { ...AnimationType.ScaleNormal, ...AnimationType.OpacityMax };
        Animation(counter, AnimationDuration.Default, animationParams);
    }

    #updateClockMargin() {
        if (!this.#config?.centerClock ||
            !this.#isVisible) return this.#setClockMargin();
        const [width = 0] = this.actor?.get_size() ?? [];
        this.#setClockMargin(width);
    }

    /**
     * @param {number} [margin]
     */
    #setClockMargin(margin = 0) {
        const parent = this.parentActor;
        if (!parent) return;
        const style = margin ? `margin-left: ${margin / Context.desktop.globalScale}px;` : null;
        parent.set_style(style);
        this.#isUpdated = true;
    }

    #updateStyle() {
        if (!this.#counter || !this.#config) return;
        const { borderColor, borderSize, backgroundColor, fontColor, padding } = this.#getStyleValues();
        const { fontSize, roundness, offset } = this.#config;
        const { fontScale, globalScale } = Context.desktop;
        this.#counter.set_style(
            `font-size: ${fontSize * fontScale}px;` +
            `padding: 0 ${padding * fontScale}px;` +
            `border-width: ${borderSize * fontScale}px;` +
            `border-color: ${borderColor};` +
            `border-radius: ${roundness * fontScale}px;` +
            `background-color: ${backgroundColor};` +
            `color: ${fontColor};`
        );
        let [_, height] = this.#counter.get_size();
        height = (height - Math.round(borderSize * fontScale * globalScale) * 4) / globalScale;
        this.#counter.style +=
            `height: ${height}px;` +
            `min-width: ${height}px;` +
            `${offset > 0 ? 'margin-top' : 'margin-bottom'}: ${Math.abs(offset)}px;`;
        this.#isUpdated = true;
    }

    /**
     * @returns {{borderColor: string, backgroundColor: string, fontColor: string, borderSize: number, padding: number}}
     */
    #getStyleValues() {
        const { colorsDnd, colorEmptyDnd, colorEmpty,
                colorNotEmptyDnd, colorNotEmpty, textColorDnd, textColor } = this.#config ?? {};
        const isDnd = !!colorsDnd && !!this.#dateMenu?.isDndEnabled;
        const isEmpty = !this.#count;
        const padding = `${this.#count}`.length === 1 ? 0 : COUNTER_LONG_VALUE_PADDING;
        const borderColor = isDnd ? colorEmptyDnd : colorEmpty;
        const borderSize = isEmpty ? COUNTER_EMPTY_BORDER_SIZE : 0;
        const backgroundColor = isEmpty ? COUNTER_EMPTY_COLOR :
                                isDnd ? colorNotEmptyDnd : colorNotEmpty;
        const fontColor = isEmpty ? COUNTER_EMPTY_COLOR :
                          isDnd ? textColorDnd : textColor;
        return { borderColor, backgroundColor, fontColor, borderSize, padding };
    }

}
