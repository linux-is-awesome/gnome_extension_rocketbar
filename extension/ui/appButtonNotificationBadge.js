/* exported AppButtonIndicator */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';

export class AppButtonNotificationBadge {

    constructor(appButton, layout, settings) {

        this._appButton = appButton;
        this._layout = layout;
        this._settings = settings;
        this._notificationBadge = null;

        this.updateConfig();
    }

    //#region public methods

    destroy() {

        this._layout = null;

        this._update();
    }

    updateConfig() {
        const oldConfig = this._config;

        this._setConfig();

        if (!oldConfig) {
            this.rerender();
            return;
        }

        if (oldConfig.notificationBadgeColor !== this._config.notificationBadgeColor ||
                oldConfig.notificationBadgeBorderColor !== this._config.notificationBadgeBorderColor ||
                oldConfig.notificationBadgePosition !== this._config.notificationBadgePosition ||
                oldConfig.notificationBadgeSize !== this._config.notificationBadgeSize ||
                oldConfig.notificationBadgeMargin !== this._config.notificationBadgeMargin) {
            this._updateStyle();
        }
    }

    rerender() {
        this._update();
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            notificationBadgeColor: this._settings.get_string('notification-badge-color'),
            notificationBadgeBorderColor: this._settings.get_string('notification-badge-border-color'),
            notificationBadgePosition: this._settings.get_string('notification-badge-position'),
            notificationBadgeSize: this._settings.get_int('notification-badge-size'),
            notificationBadgeMargin: this._settings.get_int('notification-badge-margin')
        };
    }

    _update() {

        const oldNotificationCount = this._notificationCount || 0;

        this._notificationCount = this._appButton.notifications;

        const show = (
            this._layout &&
            this._notificationCount > 0
        );

        if (!show) {

            if (this._notificationBadge) {
                this._notificationBadge.remove_all_transitions();

                // destroy without animation
                if (!this._layout) {
                    this._notificationBadge.destroy();
                    this._notificationBadge = null;
                    return;
                }

                // reasign badge instance
                let oldNotificationBadge = this._notificationBadge;
                this._notificationBadge = null;

                // animate and destroy
                oldNotificationBadge.ease({
                    opacity: 0,
                    scale_x: 0.75,
                    scale_y: 0.75,
                    duration: 200,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        oldNotificationBadge.destroy();
                    }
                });
            }
            
            return;
        }

        if (this._notificationBadge) {
            
            // zoom out the badge when new notifications comes up
            if (oldNotificationCount < this._notificationCount) {
                IconGrid.zoomOutActor(this._notificationBadge);
            }

            return;
        }

        this._notificationBadge = new St.Bin({
            name: 'taskbar-appButton-notification-badge',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            opacity: 0,
            scale_x: 0.75,
            scale_y: 0.75
        });

        this._updateStyle();

        this._layout.add_child(this._notificationBadge);

        this._notificationBadge.set_pivot_point(0.5, 0.5);

        this._notificationBadge.ease({
            opacity: 255,
            scale_x: 1,
            scale_y: 1,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _updateStyle() {

        if (!this._notificationBadge) {
            return;
        }

        this._notificationBadge.style = (
            `background-color: ${this._config.notificationBadgeColor};` +
            `width: ${this._config.notificationBadgeSize}px;` +
            `height: ${this._config.notificationBadgeSize}px;` +
            `border-radius: ${this._config.notificationBadgeSize}px;` +
            `border: 1px solid ${this._config.notificationBadgeBorderColor};`
        );

        // set position

        this._notificationBadge.style += (
            this._config.notificationBadgePosition === 'top_left' ||
                this._config.notificationBadgePosition === 'top_right' ?
            `margin-top: ${this._config.notificationBadgeMargin}px;` :
            `margin-bottom: ${this._config.notificationBadgeMargin}px;`
        ) + (
            this._config.notificationBadgePosition === 'top_left' ||
                this._config.notificationBadgePosition === 'bottom_left' ?
            `margin-left: ${this._config.notificationBadgeMargin}px;` :
            `margin-right: ${this._config.notificationBadgeMargin}px;`
        );

        this._notificationBadge.y_align = (
            this._config.notificationBadgePosition === 'top_left' ||
                this._config.notificationBadgePosition === 'top_right' ?
            Clutter.ActorAlign.START :
            Clutter.ActorAlign.END
        );

        this._notificationBadge.x_align = (
            this._config.notificationBadgePosition === 'top_left' ||
                this._config.notificationBadgePosition === 'bottom_left' ?
            Clutter.ActorAlign.START :
            Clutter.ActorAlign.END
        );

    }

    //#endregion private methods

}
