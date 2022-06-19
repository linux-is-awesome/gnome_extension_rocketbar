const { Clutter, GLib, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;

var AppButtonTooltip = class AppButtonTooltip {

    //#region public methods

    constructor(appButton, settings) {

        this._showDelay = 1000; // TODO: settings

        this._appButton = appButton;

        this._showTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._showDelay, () => {

            this._showTimeout = null;

            this._show();

            return GLib.SOURCE_REMOVE;
        });
    }

    refresh() {
        this._refresh();
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

        this._refresh();

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

    _refresh() {

        if (!this._tooltip) {
            return;
        }

        this._refreshAppTitle();
        this._refreshWindowsCount();
        this._refreshNotificationsCount();

        this._setPosition();
    }

    _refreshAppTitle() {
        this._tooltipText.text = (
            this._appButton.activeWindow ?
            this._appButton.activeWindow.title :
            this._appButton.app.get_name()
        );
    }

    _refreshWindowsCount() {

        this._windowsCounterText.text = this._appButton.windows.toString();

        if (this._appButton.windows > 1) {
            this._windowsCounter.show();
            return;
        }

        this._windowsCounter.hide();
    }

    _refreshNotificationsCount() {

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

        let [stageX, stageY] = this._appButton.get_transformed_position();

        const itemWidth = this._appButton.allocation.get_width();
        const itemHeight = this._appButton.allocation.get_height();

        const labelWidth = this._tooltip.get_width();
        const labelHeight = this._tooltip.get_height();

        const xOffset = Math.floor((itemWidth - labelWidth) / 2);
        const yOffset = 2;

        const x = Math.clamp(stageX + xOffset, 0, global.stage.width - labelWidth);

        // check if should place tooltip above or below app button
        // needed in case user has moved the panel to bottom of screen
        let labelBelowIconRect = new Meta.Rectangle({
            x,
            y: stageY + itemHeight + yOffset,
            width: labelWidth,
            height: labelHeight
        });

        let monitorIndex = Main.layoutManager.findIndexForActor(this._appButton);
        let workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        let y = 0;

        if (workArea.contains_rect(labelBelowIconRect)) {
            y = labelBelowIconRect.y;
        } else {
            y = stageY - labelHeight - yOffset;
        }

        this._tooltip.set_position(x, y);
    }

    //#endregion private methods

}