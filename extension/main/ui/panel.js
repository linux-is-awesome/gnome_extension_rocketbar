import Clutter from 'gi://Clutter';
import Context from '../core/context.js';
import { MainPanel, MainLayout, Overview } from '../core/shell.js';
import { Component, ComponentEvent } from './base/component.js';
import { ActorPressHandler } from './base/actorPressHandler.js';
import { ModuleManager } from '../services/modules.js';
import { TransparencyManager } from './panel/transparencyManager.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { Event, Module, Alignment, Delay } from '../../shared/enums/general.js';
import { ConfigOptions, ConfigKey, ConfigField } from '../../shared/enums/panel.js';

const CLICK_GESTURE_DEFAULT_BUTTON = 0;
const STYLE_CLASS = 'rocketbar__panel';
const DEFAULT_POSITION = Alignment.Top;
const DEFAULT_HEIGHT = -1;

/**
 * @augments Component<MainPanel>
 */
export default class Panel extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {Map<string, [alignment?: Alignment, position?: number]>?} */
    #items = null;

    /** @type {TransparencyManager?} */
    #transparencyManager = null;

    /** @type {Alignment} */
    #position = DEFAULT_POSITION;

    /** @type {number} */
    #height = DEFAULT_HEIGHT;

    /** @type {ActorPressHandler?} */
    #pressHandler = new ActorPressHandler(null, this.actor);

    /** @type {ModuleManager?} */
    #moduleManager = new ModuleManager(newModules => this.#updateItems([...newModules.values()]));

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    constructor() {
        super(MainPanel, true);
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        this.actor.add_style_class_name(STYLE_CLASS);
        this.connect(Event.ButtonPress, (_, event) => this.#pressHandler?.press(event));
        this.connect(Event.ButtonRelease, () => this.#pressHandler?.release(event => this.#click(event)));
        this.connect(Event.Leave, () => this.#pressHandler?.release());
        this.connect(Event.Scroll, (_, event) => this.#scroll(event));
        Context.desktop.connectInit(this, () => this.#initialize())
                       .connectScale(this, () => this.#setHeight());
    }

    #initialize() {
        this.#setHeight();
        this.#setPosition();
        this.#toggleTransparency();
        this.#handleItems();
        if (!this.#setClickGestureButton(Clutter.BUTTON_PRIMARY)) return;
        Context.signals.add(this, [Overview,
            Event.Showing, () => this.#setClickGestureButton(Clutter.BUTTON_SECONDARY + 1),
            Event.Hiding, () => this.#setClickGestureButton(Clutter.BUTTON_PRIMARY)]);
    }

    #destroy() {
        Context.desktop.disconnect(this);
        Context.jobs.removeAll(this);
        Context.signals.removeAll(this);
        this.actor.remove_style_class_name(STYLE_CLASS);
        this.#setClickGestureButton();
        this.#moduleManager?.destroy();
        this.#pressHandler?.destroy();
        this.#transparencyManager?.destroy();
        this.#setHeight(true);
        this.#setPosition(DEFAULT_POSITION);
        this.#transparencyManager = null;
        this.#moduleManager = null;
        this.#pressHandler = null;
        this.#config = null;
        this.#items = null;
        this.#events = null;
    }

    /**
     * @param {number} [button]
     * @returns {boolean}
     */
    #setClickGestureButton(button = CLICK_GESTURE_DEFAULT_BUTTON) {
        const clickGesture = this.actor._clickGesture;
        if (!clickGesture) return false;
        clickGesture.set_required_button(button);
        return true;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        if (!settingsKey) return;
        switch (settingsKey) {
            case ConfigField.items:
                this.#handleItems();
                break;
            case ConfigField.position:
                this.#setPosition();
                break;
            case ConfigField.heightAdjustment:
            case ConfigField.height:
                this.#setHeight();
                break;
            case ConfigField.transparency:
            case ConfigField.dynamicTransparency:
                this.#toggleTransparency();
                break;
        }
    }

    /**
     * @param {Alignment} [position]
     */
    #setPosition(position = this.#config?.position) {
        if (!position || position === this.#position) return;
        const { desktop, signals, hooks } = Context;
        switch (position) {
            case Alignment.Top:
                Overview._overview?.controls?.dash?.set_style(null);
                desktop.removeStyleClass(`${STYLE_CLASS}-${Alignment.Bottom}`);
                signals.remove(this, this.actor);
                hooks.removeAll(this);
                break;
            case Alignment.Bottom:
                if (typeof MainLayout._updateBoxes !== 'function') return;
                desktop.addStyleClass(`${STYLE_CLASS}-${Alignment.Bottom}`);
                signals.add(this, [this.actor, Event.HeightChanged, () =>
                    Context.jobs.replace(this, Delay.Redraw).destroy(() => MainLayout._updateBoxes())]);
                hooks.add(this, MainLayout, MainLayout._updateBoxes, () => {
                    const { primaryMonitor, panelBox } = MainLayout;
                    if (!primaryMonitor || !panelBox) return;
                    const [_, height] = panelBox.get_transformed_size();
                    panelBox.set_y(primaryMonitor.y + primaryMonitor.height - height);
                    Overview._overview?.controls?.dash?.set_style(`margin-bottom: ${height}px;`);
                });
                break;
            default: return;
        }
        MainLayout._updateBoxes();
        this.#position = position;
    }

    /**
     * @param {boolean} [isDefault]
     */
    #setHeight(isDefault = false) {
        if (!this.#config) return;
        const { heightAdjustment, height } = this.#config;
        const canAdjustHeight = !isDefault && !!heightAdjustment && typeof height === 'number';
        if (!canAdjustHeight && this.#height === DEFAULT_HEIGHT) return;
        this.#height = canAdjustHeight ? height * Context.desktop.fontScale : DEFAULT_HEIGHT;
        this.actor.set_height(this.#height);
    }

    #toggleTransparency() {
        if (!this.#config) return;
        const { transparency, dynamicTransparency } = this.#config;
        if (!transparency) {
            this.#transparencyManager?.destroy();
            this.#transparencyManager = null;
            return;
        }
        this.#transparencyManager ??= new TransparencyManager(this, dynamicTransparency);
        this.#transparencyManager.isDynamic = dynamicTransparency;
    }

    async #handleItems() {
        if (!this.#config || !this.#moduleManager) return;
        const items = new Map();
        const modules = [];
        const updatedItems = [];
        const configItems = InnerConfig(this.#config, ConfigKey.Items) ?? {};
        for (const id in configItems) {
            const itemConfig = configItems[id];
            if (!Array.isArray(itemConfig)) continue;
            const [itemName, alignment = null, position = null] = itemConfig;
            const module = Module[itemName];
            if (!module) continue;
            modules.push(module);
            const itemNewConfig = [alignment, position];
            const itemOldConfig = this.#items?.get(itemName) ?? [];
            items.set(itemName, itemNewConfig);
            if (`${itemNewConfig}` === `${itemOldConfig}`) continue;
            updatedItems.push(itemName);
        }
        this.#items = null;
        await this.#moduleManager.update(modules);
        this.#items = items;
        if (!updatedItems.length) return;
        this.#updateItems(updatedItems);
    }

    /**
     * @param {string[]} items
     */
    #updateItems(items) {
        if (!this.#items || !this.#moduleManager || !items?.length) return;
        const activeModules = this.#moduleManager.modules;
        for (const item of items) {
            const module = Module[item];
            if (!module) continue;
            const instance = activeModules?.get(module);
            if (instance instanceof Component === false) continue;
            const [alignment, position] = this.#items.get(item) ?? [];
            if (!alignment) continue;
            this.#setItemPosition(instance, alignment, position);
        }
    }

    /**
     * @param {Component} item
     * @param {Alignment} alignment
     * @param {number} [position]
     */
    #setItemPosition(item, alignment, position) {
        if (!item || !alignment) return;
        let parent = null;
        switch (alignment) {
            case Alignment.Left:
                parent = this.actor._leftBox;
                break;
            case Alignment.Center:
                parent = this.actor._centerBox;
                break;
            case Alignment.Right:
                parent = this.actor._rightBox;
                position ??= 0;
                break;
        }
        if (!parent) return;
        item.setParent(parent, position);
    }

    /**
     * @param {Clutter.Event} event
     */
    #click(event) {
        switch (event.get_button()) {
            case Clutter.BUTTON_PRIMARY:
                return this.#hideOverview();
            case Clutter.BUTTON_MIDDLE:
                return this.#muteSoundVolume();
            case Clutter.BUTTON_SECONDARY:
                break;
        }
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #scroll(event) {
        if (Context.desktop.pointerTarget !== this.actor) return Clutter.EVENT_PROPAGATE;
        return this.#changeSoundVolume(event);
    }

    #hideOverview() {
        const canCloseOverview = Overview.visible && !!this.#config?.clickToHideOverview;
        if (canCloseOverview) Overview.hide();
    }

    #muteSoundVolume() {
        if (!this.#config?.soundVolumeControl) return;
        const quickSettings = this.actor.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput;
        const outputVolumeSlider = outputVolumeIndicator?.quickSettingsItems?.[0];
        if (outputVolumeSlider instanceof Clutter.Actor === false) return;
        outputVolumeSlider.emit(Event.IconClicked);
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #changeSoundVolume(event) {
        if (!event || !this.#config?.soundVolumeControl) return Clutter.EVENT_PROPAGATE;
        const quickSettings = this.actor?.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput?._indicator;
        if (outputVolumeIndicator instanceof Clutter.Actor === false) return Clutter.EVENT_PROPAGATE;
        const isCtrlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        if (!isCtrlPressed) outputVolumeIndicator.emit(Event.Scroll, event);
        outputVolumeIndicator.emit(Event.Scroll, event);
        return Clutter.EVENT_STOP;
    }

}
