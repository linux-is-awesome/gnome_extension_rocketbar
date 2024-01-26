/**
 * JSDoc types
 *
 * @typedef {import('resource:///org/gnome/shell/ui/dateMenu.js').DateMenuButton} DateMenuButton
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Context from '../core/context.js';
import { MainPanel } from '../core/shell.js';
import { Component, ComponentEvent } from './base/component.js';
import { NotificationHandler } from '../services/notificationService.js';
import { Config } from '../utils/config.js';
import { Event, Property } from '../core/enums.js';
import { Animation, AnimationDuration, AnimationType } from './base/animation.js';

const MODULE_NAME = 'Rocketbar__NotificationCounter';
const DATE_MENU_STYLE_CLASS = 'rocketbar__date-menu';
const DND_SETTINGS_FIELD = 'show-banners';
const CLOCK_DISPLAY_POSITION = 1;
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

/** @enum {string} */
const ConfigFields = {
    hideEmpty: 'notification-counter-hide-empty',
    centerClock: 'notification-counter-center-clock',
    maxCount: 'notification-counter-max-count',
    fontSize: 'notification-counter-font-size',
    roundness: 'notification-counter-roundness',
    margin: 'notification-counter-margin-top',
    colorEmpty: 'notification-counter-color-empty',
    colorNotEmpty: 'notification-counter-color-not-empty',
    textColor: 'notification-counter-text-color',
    colorEmptyDnd: 'notification-counter-color-empty-dnd',
    colorNotEmptyDnd: 'notification-counter-color-not-empty-dnd',
    textColorDnd: 'notification-counter-text-color-dnd'
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

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = data => ({
        [ComponentEvent.Destroy]: this.#destroy
    })[data?.event]?.call(this);

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
        return this.#dateMenu?._indicator?._settings?.get_boolean(DND_SETTINGS_FIELD) === false;
    }

    constructor() {
        super(new St.BoxLayout({ name: `${MODULE_NAME}-${DateMenu.name}` }));
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
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
            [target, Event.Visible, indicator => indicator?.hide()],
            [target._settings, `changed::${DND_SETTINGS_FIELD}`, () => this.notifyChildren(DateMenuEvent.DndChanged)]);
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
        this.actor?.remove_all_children();
        if (!this.#dateMenu) return;
        this.#dateMenu.remove_style_class_name(DATE_MENU_STYLE_CLASS);
        this.#dateMenu._clockDisplay?.set_style_class_name(this.#clockDisplayStyleClass);
        this.#dateMenu._indicator?._sync();
        if (this.#dateMenu._clockDisplay && !this.#dateMenu._clockDisplay?.get_parent()) {
            this.#container?.insert_child_at_index(this.#dateMenu._clockDisplay, CLOCK_DISPLAY_POSITION);
        }
        this.#dateMenu = null;
    }

}

/**
 * @augments Component<St.BoxLayout>
 */
export default class NotificationCounter extends Component {

    /**
     * @param {{event: string}} data
     * @returns {void}
     */
    #notifyHandler = data => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Mapped]: () => Context.layout.queueAfterInit(this, () => this.#rerender()),
        [ComponentEvent.Scale]: this.#rerender,
        [DateMenuEvent.DndChanged]: this.#updateStyle
    })[data?.event]?.call(this);

    /** @type {St.Label?} */
    #counter = null;

    /** @type {number} */
    #count = 0;

    /** @type {number} */
    #totalCount = 0;

    /** @type {Config} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey));

    /** @type {DateMenu} */
    #dateMenu = new DateMenu();

    /** @type {NotificationHandler} */
    #notificationHandler = new NotificationHandler(count => this.#setCount(count));

    /** @type {boolean} */
    get #isVisible() {
        return this.#count > 0 || !this.#config.hideEmpty;
    }

    constructor() {
        super(new St.BoxLayout({ name: MODULE_NAME }));
        this.#createCounter();
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
        Context.signals.add(this, [St.Settings.get(), Event.FontName, () => this.#rerender()]);
        Context.layout.requestInit(this, () => this.setParent(this.#dateMenu));
    }

    #destroy() {
        Context.layout.removeClient(this);
        Context.signals.removeAll(this);
        this.#counter?.remove_all_transitions();
        this.#dateMenu?.destroy();
        this.#notificationHandler?.destroy();
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
            case ConfigFields.hideEmpty:
                if (this.#isVisible) {
                    if (!this.#counter.visible) this.#rerender();
                    return;
                }
                this.#counter.hide();
            case ConfigFields.centerClock:
                this.#updateClockMargin();
                break;
            case ConfigFields.maxCount:
                this.#setCount(this.#totalCount);
                break;
            case ConfigFields.fontSize:
                this.#updateStyle();
                this.#updateClockMargin();
                break;
            default: this.#updateStyle();
        }
    }

    /**
     * @param {number} count
     */
    #setCount(count) {
        if (!this.isValid) return;
        this.#totalCount = count;
        if (count > this.#config.maxCount) {
            count = this.#config.maxCount;
        }
        if (this.#count === count) return;
        this.#count = count;
        this.#rerender();
    }

    #rerender() {
        if (!this.isMapped || !this.#counter || Context.layout.isQueued(this)) return;
        this.#counter.remove_all_transitions();
        this.#counter.remove_style_pseudo_class(COUNTER_STYLE_PSEUDO_CLASS);
        Animation(this.#counter, AnimationDuration.Faster, AnimationType.ScaleMin).then(() => {
            if (!this.isValid || !this.#counter) return;
            this.#counter.text = `${this.#count}`;
            if (!this.#isVisible) {
                this.#counter.hide();
                this.#updateClockMargin();
                return;
            }
            this.#counter.show();
            this.#updateStyle();
            this.#updateClockMargin();
            this.#counter.add_style_pseudo_class(COUNTER_STYLE_PSEUDO_CLASS);
            Animation(this.#counter, AnimationDuration.Default, { ...AnimationType.ScaleNormal, ...AnimationType.OpacityMax });
        });
    }

    #updateClockMargin() {
        const parent = this.parentActor;
        if (!parent) return;
        if (!this.#config.centerClock || !this.#isVisible) {
            parent.set_style(null);
            return;
        }
        const [width] = this.actor?.get_size() ?? [];
        if (!width) return;
        parent.set_style(`margin-left: ${width / this.globalScale}px;`);
    }

    #updateStyle() {
        if (!this.#counter) return;
        const { borderColor, borderSize, backgroundColor, textColor, padding } = this.#getStyleValues();
        const { fontSize, roundness, margin } = this.#config;
        const scale = this.uiScale;
        const globalScale = this.globalScale;
        this.#counter.set_style(
            `font-size: ${fontSize * scale}px;` +
            `padding: 0 ${padding * scale}px;` +
            `border-width: ${borderSize * scale}px;` +
            `border-color: ${borderColor};` +
            `border-radius: ${roundness * scale}px;` +
            `background-color: ${backgroundColor};` +
            `color: ${textColor};`
        );
        let [_, height] = this.#counter.get_size();
        height = (height - Math.round(borderSize * scale * globalScale) * 4) / globalScale;
        this.#counter.style +=
            `height: ${height}px;` +
            `min-width: ${height}px;` +
            `${margin > 0 ? 'margin-top' : 'margin-bottom'}: ${Math.abs(margin)}px;`;
    }

    #getStyleValues() {
        const isDnd = this.#dateMenu?.isDndEnabled;
        const isEmpty = !this.#count;
        const padding = `${this.#count}`.length === 1 ? 0 : COUNTER_LONG_VALUE_PADDING;
        const borderColor = isDnd ? this.#config.colorEmptyDnd : this.#config.colorEmpty;
        const borderSize = isEmpty ? COUNTER_EMPTY_BORDER_SIZE : 0;
        const backgroundColor = isEmpty ? COUNTER_EMPTY_COLOR :
                                isDnd ? this.#config.colorNotEmptyDnd : this.#config.colorNotEmpty;
        const textColor = isEmpty ? COUNTER_EMPTY_COLOR :
                          isDnd ? this.#config.textColorDnd : this.#config.textColor;
        return { borderColor, borderSize, backgroundColor, textColor, padding };
    }

}
