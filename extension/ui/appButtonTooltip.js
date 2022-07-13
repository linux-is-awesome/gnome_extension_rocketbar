const { Clutter, GLib, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;

class TooltipIndicator {

    constructor(iconName) {

        // define default styling params

        const style = 'margin-left: 8px;'
        const textStyle = 'margin-left: 5px;'
        const iconSize = 15;

        // create layout

        this.actor = new St.BoxLayout({
            name: 'appButton-tooltip-counter',
            style: style
        });

        this.actor.add_actor(new St.Icon({
            name: 'appButton-tooltip-counter-icon',
            icon_name: iconName,
            style_class: 'system-status-icon',
            width: iconSize,
            height: iconSize,
            opacity: 200
        }));

        this._label = new St.Label({
            name: 'appButton-tooltip-counter-text',
            style: textStyle
        });

        this.actor.add_actor(this._label);
    }

    setText(text) {
        this._label.text = text + '';
    }

}

class TooltipCounter extends TooltipIndicator {

    setCount(count) {

        this.setText(count || 0);

        if (count && count > 1) {
            this.actor.show();
            return;
        }

        this.actor.hide();
    }
}

var AppButtonTooltip = class {

    //#region public methods

    constructor(appButton, settings) {

        this._showDelay = settings.get_int('tooltip-show-delay');

        this._appButton = appButton;

        this._showTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._showDelay, () => {

            this._showTimeout = null;

            this._show();

            return GLib.SOURCE_REMOVE;
        });
    }

    rerender() {
        this._update();
    }

    destroy(animation) {

        if (this._showTimeout) {
            GLib.source_remove(this._showTimeout);
            this._showTimeout = null;
        }

        if (!this._tooltip) {
            return;
        }

        this._tooltip.remove_all_transitions();

        if (animation) {
            this._tooltip.ease({
                opacity: 0,
                duration: 100,
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

        this._setPosition();

        this._tooltip.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _createTooltip() {

        this._tooltip = new St.BoxLayout({
            name: 'appButton-tooltip',
            style_class: 'dash-label',
            style: (
                'border: 1px solid rgba(255, 255, 255, 0.1);' +
                'box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);'
            ),
            opacity: 0
        });

        // create tooltip text

        this._tooltipText = new St.Label({
            name: 'appButton-tooltip-text',
            style: 'max-width: 500px;'
        });

        this._tooltip.add_actor(this._tooltipText);

        // create windows counter

        this._windowsCounter = new TooltipCounter('window-symbolic');

        this._tooltip.add_actor(this._windowsCounter.actor);

        // create notifications counter

        this._notificationsCounter = new TooltipCounter('notifications-symbolic');

        this._tooltip.add_actor(this._notificationsCounter.actor);

        // create sound icons

        this._soundOutputVolume = new TooltipIndicator('audio-speakers-symbolic');
        this._soundInputVolume = new TooltipIndicator('audio-input-microphone-symbolic');

        this._tooltip.add_actor(this._soundOutputVolume.actor);
        this._tooltip.add_actor(this._soundInputVolume.actor);

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
            this._soundOutputVolume.setText(
                Math.round(this._appButton.soundVolumeControl.getOutputVolume() * 100)
            );
            this._soundOutputVolume.actor.show();
        } else {
            this._soundOutputVolume.actor.hide();
        }

        if (this._appButton?.soundVolumeControl?.hasInput()) {
            this._soundInputVolume.setText(
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

        const [appButtonWidth, appButtonHeight] = this._appButton.get_size();

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