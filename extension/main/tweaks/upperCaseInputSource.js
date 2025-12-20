/**
 * @typedef {import('resource:///org/gnome/shell/ui/status/keyboard.js').InputSourceIndicator} InputSourceIndicator
 */
import { getInputSourceManager as InputSourceManager,
         InputSourcePopup } from 'resource:///org/gnome/shell/ui/status/keyboard.js';
import { MainPanel } from '../core/shell.js';
import Context from '../core/context.js';
import { Event } from '../../shared/enums/general.js';

export default class {

    /** @type {InputSourceIndicator?} */
    #inputSourceIndicator = MainPanel.statusArea?.keyboard;

    constructor() {
        const inputSourceManager = InputSourceManager();
        Context.signals.add(this,
            [inputSourceManager, Event.SourcesChanged, () => this.#updateIndicator()]);
        this.#updatePopup();
        this.#updateIndicator();
    }

    destroy() {
        Context.signals.removeAll(this);
        Context.hooks.removeAll(this);
        this.#inputSourceIndicator?._sourcesChanged();
        this.#inputSourceIndicator?._currentSourceChanged();
        this.#inputSourceIndicator = null;
    }

    #updatePopup() {
        const prototype = InputSourcePopup.prototype;
        Context.hooks.add(this, prototype, prototype._init, (_, items, ...args) => [
            null, items.map(item => ({
                shortName: item._shortName?.toUpperCase(),
                displayName: item.displayName,
                activate: () => item.activate()
            })), ...args
        ], true);
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
