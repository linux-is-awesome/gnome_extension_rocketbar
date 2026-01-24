import Clutter from 'gi://Clutter';
import { MainPanel, Overview } from '../core/shell.js';
import Context from '../core/context.js';
import { ModuleManager } from '../services/modules.js';
import { Component, ComponentEvent } from './base/component.js';
import { ActorPressHandler } from './base/actorPressHandler.js';
import { Config, InnerConfig } from '../../shared/utils/config.js';
import { Event, Module, Alignment } from '../../shared/enums/general.js';
import { ConfigOptions, ConfigKey, ConfigField } from '../../shared/enums/panel.js';

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

    /** @type {ActorPressHandler?} */
    #pressHandler = new ActorPressHandler(null, this.actor);

    /** @type {ModuleManager?} */
    #moduleManager = new ModuleManager(newModules => this.#updateItems([...newModules.values()]));

    /** @type {Config?} */
    #config = Config(this, ConfigField, settingsKey => this.#handleConfig(settingsKey), ConfigOptions);

    constructor() {
        super(MainPanel, true);
        super.notifyCallback = data => this.#events?.[data?.event]?.();
        Context.signals.add(this, [this.actor,
            Event.ButtonPress, (_, event) => this.#pressHandler?.press(event),
            Event.ButtonRelease, () => this.#pressHandler?.release(event => this.#click(event)),
            Event.Leave, () => this.#pressHandler?.release(),
            Event.Scroll, (_, event) => this.#scroll(event)]);
        this.#handleConfig();
    }

    #destroy() {
        Context.signals.removeAll(this);
        this.#moduleManager?.destroy();
        this.#pressHandler?.destroy();
        this.#moduleManager = null;
        this.#pressHandler = null;
        this.#config = null;
        this.#events = null;
        this.#items = null;
    }

    /**
     * @param {string?} [settingsKey]
     */
    #handleConfig(settingsKey) {
        if (settingsKey && settingsKey !== ConfigField.items) return;
        this.#handleItems();
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
            if (!instance) continue;
            const [alignment, position] = this.#items.get(item) ?? [];
            if (!alignment) continue;
            this.#setItemPosition(instance, alignment, position);
        }
    }

    /**
     * @param {Component|Clutter.Actor} item
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
        if (item instanceof Component) item.setParent(parent, position);
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
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
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #scroll(event) {
        if (Context.desktop.pointerTarget !== this.actor) return Clutter.EVENT_PROPAGATE;
        return this.#changeSoundVolume(event);
    }

    /**
     * @returns {boolean}
     */
    #hideOverview() {
        const canCloseOverview = Overview.visible && !!this.#config?.clickToHideOverview;
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
        const quickSettings = this.actor?.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput?._indicator;
        if (outputVolumeIndicator instanceof Clutter.Actor === false) return Clutter.EVENT_PROPAGATE;
        const isCtrlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
        if (!isCtrlPressed) outputVolumeIndicator.emit(Event.Scroll, event);
        outputVolumeIndicator.emit(Event.Scroll, event);
        return Clutter.EVENT_STOP;
    }

}
