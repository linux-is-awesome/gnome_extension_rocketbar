/**
 * @typedef {import('resource:///org/gnome/shell/ui/status/keyboard.js').InputSourceIndicator} InputSourceIndicator
 */
import { getInputSourceManager as InputSourceManager,
         InputSourcePopup } from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { MainPanel } from '../main/shell.js';
import Context from '../main/context.js';
import { Event } from '../shared/enums.js';

export default class {

    /** @type {InputSourceIndicator?} */
    #inputSourceIndicator = MainPanel.statusArea?.keyboard;

    /** @type {((...args) => void)?} */
    #backup = null;

    constructor() {
        const inputSourceManager = InputSourceManager();
        Context.signals.add(this,
            [inputSourceManager, Event.SourcesChanged, () => this.#updateIndicator()]);
        this.#updatePopup();
        this.#updateIndicator();
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#inputSourceIndicator?._sourcesChanged();
        this.#inputSourceIndicator?._currentSourceChanged();
        this.#inputSourceIndicator = null;
        if (typeof this.#backup !== 'function') return;
        InputSourcePopup.prototype._init = this.#backup;
        this.#backup = null;
    }

    #updatePopup() {
        const initPopupFunction = InputSourcePopup.prototype._init;
        InputSourcePopup.prototype._init = function (items, ...args) {
            items = items?.map(item => ({
                shortName: item._shortName?.toUpperCase(),
                displayName: item.displayName,
                activate: () => item.activate()
            }));
            initPopupFunction.call(this, items, ...args);
        };
        this.#backup = initPopupFunction;
    }

    #updateIndicator() {
        if (!this.#inputSourceIndicator) return;
        const indicatorLabels = this.#inputSourceIndicator._indicatorLabels;
        const menuItems = this.#inputSourceIndicator._menuItems;
        if (!indicatorLabels) return;
        for (const key in indicatorLabels) {
            const label = indicatorLabels[key];
            if (typeof label?.set_text !== 'function') continue;
            label.set_text = text => label.constructor.prototype.set_text.call(label, text?.toUpperCase());
            label.set_text(label.text);
            const menuLabel = menuItems?.[key]?.indicator;
            if (typeof menuLabel?.set_text !== 'function') continue;
            menuLabel.set_text = text => menuLabel.constructor.prototype.set_text.call(menuLabel, text?.toUpperCase());
            menuLabel.set_text(menuLabel.text);
        }
    }

}
