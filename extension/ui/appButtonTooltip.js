/* exported AppButtonTooltip */

//#region imports

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// custom modules import
import { Timeout } from '../utils/timeout.js';

//#endregion imports

class TooltipCounter {

    constructor(icon, minCount) {

        this._minCount = minCount || 0;

        // create layout

        this.actor = new St.BoxLayout({
            name: 'appButton-tooltip-counter',
            style_class: 'rocketbar__tooltip_counter'
        });

        this.actor.add_child(new St.Icon({
            name: 'appButton-tooltip-counter-icon',
            gicon: icon
        }));

        this._label = new St.Label({
            name: 'appButton-tooltip-counter-text'
        });

        this.actor.add_child(this._label);
    }

    setCount(count) {

        count = count || 0;

        this._label.text = count.toString();

        if (count < this._minCount) {
            this.actor.hide();
            return;
        }

        this.actor.show();
    }
}

export class AppButtonTooltip {

    //#region public methods

    constructor(appButton, settings, iconProvider) {

        this._appButton = appButton;
        this._iconProvider = iconProvider;

        this._maxWidth = settings.get_int('tooltip-max-width');

        const showDelay = settings.get_int('tooltip-show-delay');

        this._showTimeout = Timeout.default(showDelay).run(() => {
            this._showTimeout = null;
            this._show();
        });
    }

    rerender() {
        this._update();
    }

    destroy(animation) {

        this._showTimeout?.destroy();

        if (!this._tooltip) {
            return;
        }

        this._tooltip.remove_all_transitions();

        if (animation) {
            this._tooltip.ease({
                opacity: 0,
                duration: 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._tooltip.destroy()
            });
            return;
        }

        this._tooltip.destroy();
    }

    //#endregion public methods

    //#region private methods

    _show() {

        this._createTooltip();

        this._update();

        this._tooltip.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _createTooltip() {

        this._tooltip = new St.BoxLayout({
            name: 'appButton-tooltip',
            style_class: 'dash-label rocketbar__tooltip',
            opacity: 0
        });

        // create tooltip text

        this._tooltipText = new St.Label({
            name: 'appButton-tooltip-text',
            style: `max-width: ${this._maxWidth}px;`
        });

        this._tooltip.add_child(this._tooltipText);

        // create windows counter

        this._windowsCounter = new TooltipCounter(this._iconProvider.getIcon('window-symbolic'), 2);

        this._tooltip.add_child(this._windowsCounter.actor);

        // create notifications counter

        this._notificationsCounter = new TooltipCounter(this._iconProvider.getIcon('notification-symbolic'), 1);

        this._tooltip.add_child(this._notificationsCounter.actor);

        // create sound icons

        this._soundOutputVolume = new TooltipCounter(this._iconProvider.getIcon('audio-speakers-symbolic'));
        this._soundInputVolume = new TooltipCounter(this._iconProvider.getIcon('audio-input-microphone-symbolic'));

        this._tooltip.add_child(this._soundOutputVolume.actor);
        this._tooltip.add_child(this._soundInputVolume.actor);

        // all ui elements created!

        Main.layoutManager.addChrome(this._tooltip);
    }

    _update() {

        if (!this._tooltip) {
            return;
        }

        this._updateAppTitle();
        this._updateWindowsCount();
        this._updateNotificationsCount();
        this._updateSoundVolumeIndicators();

        this._setPosition();
    }

    _updateAppTitle() {
        this._tooltipText.text = (
            this._appButton.activeWindow ?
            this._appButton.activeWindow.title :
            this._appButton.app.get_name()
        );
    }

    _updateWindowsCount() {
        this._windowsCounter.setCount(this._appButton.windows);
    }

    _updateNotificationsCount() {
        this._notificationsCounter.setCount(this._appButton.notifications);
    }

    _updateSoundVolumeIndicators() {

        if (this._appButton?.soundVolumeControl?.hasOutput()) {
            this._soundOutputVolume.setCount(
                Math.round(this._appButton.soundVolumeControl.getOutputVolume() * 100)
            );
            this._soundOutputVolume.actor.show();
        } else {
            this._soundOutputVolume.actor.hide();
        }

        if (this._appButton?.soundVolumeControl?.hasInput()) {
            this._soundInputVolume.setCount(
                Math.round(this._appButton.soundVolumeControl.getInputVolume() * 100)
            );
            this._soundInputVolume.actor.show();
        } else {
            this._soundInputVolume.actor.hide();
        }

    }

    _setPosition() {

        if (!this._tooltip) {
            return;
        }

        let [x, y] = this._appButton.get_transformed_position();

        const [appButtonWidth, appButtonHeight] = [
            this._appButton.allocation.get_width(),
            this._appButton.allocation.get_height()
        ];

        const [tooltipWidth, tooltipHeight] = this._tooltip.get_size();

        const xOffset = Math.floor((appButtonWidth - tooltipWidth) / 2);
        
        // define a static vertical offset
        const yOffset = 3;

        // if app button is on top of the screen
        if (y < 100) {
            y = y + appButtonHeight + yOffset;
        } else {
            y = y - tooltipHeight - yOffset;
        }

        x = Math.clamp(x + xOffset, 0, global.stage.width - tooltipWidth);

        this._tooltip.set_position(x, y);
    }

    //#endregion private methods

}
