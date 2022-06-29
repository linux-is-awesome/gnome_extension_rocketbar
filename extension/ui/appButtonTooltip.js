const { Clutter, GLib, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;

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
            name: 'appButton-tooltip-text'
        });

        this._tooltip.add_actor(this._tooltipText);

        // create common styles for counters
        const counterStyle = 'margin-left: 8px;'
        const counterTextStyle = 'margin-left: 5px;'
        const counterIconSize = 15;

        // create windows counter

        this._windowsCounter = new St.BoxLayout({
            name: 'appButton-tooltip-windows-counter',
            style: counterStyle
        });
        
        this._windowsCounter.add_actor(new St.Icon({
            name: 'appButton-tooltip-windows-counter-icon',
            icon_name: 'window-symbolic',
            style_class: 'system-status-icon',
            width: counterIconSize,
            height: counterIconSize,
            opacity: 200
        }));

        this._windowsCounterText = new St.Label({
            name: 'appButton-tooltip-windows-counter-text',
            style: counterTextStyle
        });

        this._windowsCounter.add_actor(this._windowsCounterText);

        this._tooltip.add_actor(this._windowsCounter);

        // create notifications counter

        this._notificationsCounter = new St.BoxLayout({
            name: 'appButton-tooltip-notifications-counter',
            style: counterStyle
        });

        this._notificationsCounter.add_actor(new St.Icon({
            name: 'appButton-tooltip-windows-notifications-icon',
            icon_name: 'notifications-symbolic',
            style_class: 'system-status-icon',
            width: counterIconSize,
            height: counterIconSize,
            opacity: 200
        }));

        this._notificationsCounterText = new St.Label({
            name: 'appButton-tooltip-windows-notifications-text',
            style: counterTextStyle
        });

        this._notificationsCounter.add_actor(this._notificationsCounterText);

        this._tooltip.add_actor(this._notificationsCounter);

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

        this._windowsCounterText.text = this._appButton.windows.toString();

        if (this._appButton.windows > 1) {
            this._windowsCounter.show();
            return;
        }

        this._windowsCounter.hide();
    }

    _updateNotificationsCount() {

        this._notificationsCounterText.text = this._appButton.notifications.toString();

        if (this._appButton.notifications) {
            this._notificationsCounter.show();
            return;
        }

        this._notificationsCounter.hide();
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
        if (y < 1) {
            y = y + appButtonHeight + yOffset;
        } else {
            y = y - tooltipHeight - yOffset;
        }

        x = Math.clamp(x + xOffset, 0, global.stage.width - tooltipWidth);

        this._tooltip.set_position(x, y);
    }

    //#endregion private methods

}