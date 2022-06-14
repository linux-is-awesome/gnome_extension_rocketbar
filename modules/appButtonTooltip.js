const { Clutter, GLib, GObject, Meta, St } = imports.gi;
const Main = imports.ui.main;

var AppButtonTooltip = class AppButtonTooltip {

    constructor(appButton) {

        this._showDelay = 1000;

        this._appButton = appButton;

        this._tooltip = new St.Label({
            style_class: 'dash-label',
            text: appButton.app.get_name(),
            style: 'border: 1px solid rgba(0, 0, 0, 0.1);',
            opacity: 0
        });

        Main.layoutManager.addChrome(this._tooltip);

        this._show();
    }

    destroy(animation) {
        this._tooltip.remove_all_transitions();

        if (animation && !this._showTimeout) {
            this._tooltip.ease({
                opacity: 0,
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._tooltip.destroy()
            });
            return;
        }

        if (this._showTimeout) {
            GLib.source_remove(this._showTimeout);
        }

        this._tooltip.destroy();
    }

    _show() {

        if (!this._showTimeout) {
            this._showTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._showDelay, () => this._show());
            return;
        }

        this._showTimeout = null;

        let [stageX, stageY] = this._appButton.get_transformed_position();

        const itemWidth = this._appButton.allocation.get_width();
        const itemHeight = this._appButton.allocation.get_height();

        const labelWidth = this._tooltip.get_width();
        const labelHeight = this._tooltip.get_height();

        const xOffset = Math.floor((itemWidth - labelWidth) / 2);
        const yOffset = 2;

        const x = Math.clamp(stageX + xOffset, 0, global.stage.width - labelWidth);

        //Check if should place tool-tip above or below app icon
        //Needed in case user has moved the panel to bottom of screen
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

        this._tooltip.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        return GLib.SOURCE_REMOVE;
    }

}