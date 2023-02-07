/* exported AppButton */

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Main } from '../../core/legacy.js';
import { Event } from '../../core/enums.js';
import { Button } from '../base/button.js';
import { ComponentEvent } from '../base/component.js';
import { TaskbarClient } from '../../services/taskbarService.js';

const MODULE_NAME = 'Rocketbar__Taskbar_AppButton';

export class AppButton extends Button {

    /**
     * @param {{event: string, params: *}} data
     * @returns {void}
     */
    #notifyHandler = (data) => ({
        [ComponentEvent.Destroy]: this.#destroy,
        [ComponentEvent.Mapped]: () => {},
        [Event.Clicked]: () => this.#activate(data?.params)
    })[data?.event]?.call(this);

    /** @type {Shell.App} */
    #app = null;

    /** @type {St.Widget} */
    #layout = new St.Widget({ name: `${MODULE_NAME}.Layout`, layout_manager: new Clutter.BinLayout() });

    /** @type {TaskbarClient} */
    #service = null;

    /** @type {Set<Meta.Window>} */
    #windows = null;

    /** @type {Shell.App} */
    get app() {
        return this.#app;
    }

    /**
     * @param {Shell.App} app
     */
    constructor(app) {
        super(new St.Bin({ style_class: 'panel-button' }), MODULE_NAME);
        this.#layout.add_child(this.display);
        this.actor.set_child(this.#layout);
        this.#app = app;
        this.#service = new TaskbarClient(() => this.#handleState(), app);
        this.#connectSignals();
        // TODO
        this.#setIcon();
    }

    #destroy() {
        if (!this.#service) return;
        this.#service?.destroy();
        this.#service = null;
    }

    #connectSignals() {
        this.connect(ComponentEvent.Notify, data => this.#notifyHandler(data));
    }

    #handleState() {
        if (!this.isValid) return;
        const isFavorite = this.#service.favorites?.apps?.has(this.#app);
        this.#windows = this.#service.queryWindows(true, true);
        if (!isFavorite && !this.#windows?.size) this.destroy();
    }

    #setIcon() {
        this.display.set_child(this.#app.create_icon_texture(20));
    }

    #activate(params) {
        if (!params) return;
        const { event, button } = params;
        if (!this.#windows?.size) this.#app.activate();
        else Main.activateWindow([...this.#windows][0]);
    }

}
