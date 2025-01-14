import Clutter from 'gi://Clutter';
import { MainPanel, Overview } from '../main/shell.js';
import Context from '../main/context.js';
import { Component, ComponentEvent } from './base/component.js';
import { Event } from '../shared/enums.js';
import { ModuleManager, Module } from '../services/modules.js';
import { Config, InnerConfig } from '../utils/config.js';

const CONFIG_PATH = 'panel';

/** @enum {string} */
const PanelArea = {
    Left: 'left',
    Center: 'center',
    Right: 'right'
};

/** @enum {string} */
const ConfigFields = {
    items: 'items',
    soundVolumeControl: 'sound-volume-control',
    clickHideOverview: 'click-hide-overview'
};

/**
 * @augments Component<MainPanel>
 */
export default class Panel extends Component {

    /** @type {{[event: string]: () => *}?} */
    #events = {
        [ComponentEvent.Destroy]: () => this.#destroy()
    };

    /** @type {number?} */
    #pressedButton = null;

    /** @type {Map<string, [area?: PanelArea, position?: number]>?} */
    #items = null;

    /** @type {ModuleManager?} */
    #moduleManager = new ModuleManager(newModules => this.#updateItems([...newModules.values()]));

    /** @type {Config?} */
    #config = Config(this, ConfigFields, settingsKey => this.#handleConfig(settingsKey), { path: CONFIG_PATH });

    /** @type {boolean} */
    get #isEventSource() {
        if (!this.isValid) return false;
        const [x, y] = global.get_pointer();
        const currentActor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
        return this.actor === currentActor;
    }

    constructor() {
        super(MainPanel, true);
        this.connect(ComponentEvent.Notify, data => this.#events?.[data?.event]?.());
        Context.signals.add(this, [
            this.actor,
            Event.ButtonPress, (_, event) => this.#handlePress(event),
            Event.ButtonRelease, (_, event) => this.#handleRelease(event),
            Event.Leave, () => this.#handleRelease(),
            Event.Scroll, (_, event) => this.#scroll(event)
        ]);
        this.#handleConfig();
    }

    #destroy() {
        Context.signals.removeAll(this);
        this.#moduleManager?.destroy();
        this.#moduleManager = null;
        this.#pressedButton = null;
        this.#config = null;
        this.#events = null;
        this.#items = null;
    }

    /**
     * @param {string?} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (settingsKey && settingsKey !== ConfigFields.items) return;
        this.#handleItems();
    }

    async #handleItems() {
        if (!this.#config || !this.#moduleManager) return;
        const items = new Map();
        const modules = [];
        const updatedItems = [];
        const configItems = InnerConfig(this.#config, ConfigFields.items) ?? {};
        for (const id in configItems) {
            const itemConfig = configItems[id];
            if (!Array.isArray(itemConfig)) continue;
            const [itemName, area = null, position = null] = itemConfig;
            const module = Module[itemName];
            if (!module) continue;
            modules.push(module);
            const itemNewConfig = [area, position];
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
            if (!instance) continue;
            const [area, position] = this.#items.get(item) ?? [];
            if (!area) continue;
            this.#setItemPosition(instance, area, position);
        }
    }

    /**
     * @param {Component|Clutter.Actor} item
     * @param {PanelArea} area
     * @param {number} [position]
     */
    #setItemPosition(item, area, position) {
        if (!item || !area) return;
        let parent = null;
        switch (area) {
            case PanelArea.Left:
                parent = this.actor._leftBox;
                break;
            case PanelArea.Center:
                parent = this.actor._centerBox;
                break;
            case PanelArea.Right:
                parent = this.actor._rightBox;
                position ??= 0;
                break;
        }
        if (!parent) return;
        if (item instanceof Component) item.setParent(parent, position);
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #handlePress(event) {
        if (!event || !this.#isEventSource) return Clutter.EVENT_PROPAGATE;
        this.#pressedButton = event.get_button();
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * @param {Clutter.Event} [event]
     * @returns {boolean}
     */
    #handleRelease(event) {
        const button = event?.get_button();
        if (typeof this.#pressedButton === 'number' &&
            this.#pressedButton === button && event &&
            this.#isEventSource) return this.#click();
        this.#pressedButton = null;
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * @returns {boolean}
     */
    #click() {
        switch (this.#pressedButton) {
            case Clutter.BUTTON_PRIMARY:
                return this.#hideOverview();
            case Clutter.BUTTON_MIDDLE:
                return this.#muteSoundVolume();
            case Clutter.BUTTON_SECONDARY:
                break;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #scroll(event) {
        if (!event || !this.#isEventSource) return Clutter.EVENT_PROPAGATE;
        return this.#changeSoundVolume(event);
    }

    /**
     * @returns {boolean}
     */
    #hideOverview() {
        const canCloseOverview = Overview.visible && !!this.#config?.clickHideOverview;
        if (!canCloseOverview) return Clutter.EVENT_PROPAGATE;
        Overview.hide();
        return Clutter.EVENT_STOP;
    }

    /**
     * @returns {boolean}
     */
    #muteSoundVolume() {
        if (!this.#config?.soundVolumeControl) return Clutter.EVENT_PROPAGATE;
        const quickSettings = this.actor?.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput;
        const outputVolumeSlider = outputVolumeIndicator?.quickSettingsItems?.[0];
        if (outputVolumeSlider instanceof Clutter.Actor === false) return Clutter.EVENT_PROPAGATE;
        outputVolumeSlider.emit(Event.IconClicked);
        return Clutter.EVENT_STOP;
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #changeSoundVolume(event) {
        if (!event || !this.#config?.soundVolumeControl) return Clutter.EVENT_PROPAGATE;
        const scrollDirection = event.get_scroll_direction();
        const isCtrlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        if (isCtrlPressed && scrollDirection === Clutter.ScrollDirection.SMOOTH) return Clutter.EVENT_PROPAGATE;
        const quickSettings = this.actor?.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput?._indicator;
        if (outputVolumeIndicator instanceof Clutter.Actor === false) return Clutter.EVENT_PROPAGATE;
        outputVolumeIndicator.emit(Event.Scroll, event);
        return Clutter.EVENT_STOP;
    }

}
