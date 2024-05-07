import Clutter from 'gi://Clutter';
import { MainPanel } from '../core/shell.js';
import Context from '../core/context.js';
import { Component, ComponentEvent } from './base/component.js';
import { Event } from '../core/enums.js';
import { Config } from '../utils/config.js';

const CONFIG_PATH = 'panel';

/** @enum {string} */
const ConfigFields = {
    soundVolumeControl: 'sound-volume-control'
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
    }

    #destroy() {
        Context.signals.removeAll(this);
        this.#pressedButton = null;
        this.#config = null;
        this.#events = null;
    }

    /**
     * @param {string} settingsKey
     */
    #handleConfig(settingsKey) {
        switch (settingsKey) {
            default:
        }
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
     * @param {Clutter.Event} event
     * @returns {boolean}
     */
    #changeSoundVolume(event) {
        if (!event || !this.#config?.soundVolumeControl) return Clutter.EVENT_PROPAGATE;
        const quickSettings = this.actor?.statusArea?.quickSettings;
        const outputVolumeIndicator = quickSettings?._volumeOutput?._indicator;
        if (outputVolumeIndicator instanceof Clutter.Actor === false) return Clutter.EVENT_PROPAGATE;
        outputVolumeIndicator.emit(Event.Scroll, event);
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

}
