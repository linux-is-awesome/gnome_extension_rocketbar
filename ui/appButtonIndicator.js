const { Clutter, St } = imports.gi;

var AppButtonIndicator = class AppButtonIndicator {

    constructor(appButton, layout, settings) {

        this._appButton = appButton;
        this._layout = layout;
        this._settings = settings;
        this._indicators = null;
        this._notificationBadge = null;
        this._isActive = false;
        this._dominantColor = null;

        this._setConfig();
    }

    //#region public methods

    destroy() {

        this._layout = null;

        this._destroyIndicators();
        this._updateNotificationBadge();
    }

    updateConfig() {
        const oldConfig = this._config;

        this._setConfig();

        this.rerender();
    }

    rerender() {
        this._updateIndicators();
        this._updateNotificationBadge();
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            enableIndicators: this._settings.get_boolean('appbutton-enable-indicators'),
            enableNotificationBadges: this._settings.get_boolean('appbutton-enable-notification-badges'),
            color: 'rgb(255, 255, 255)',
            activeColor: 'rgb(53, 132, 228)',
            dominantColor: true,
            activeDominantColor: true,
            size: 4,
            maxIndicators: 3,
            // notification badge
            notificationBadgeSize: 5,
            notificationBadgeMargin: 7,
            notificationBadgeColor: 'rgb(255, 0, 0)',
            notificationBadgeBorderColor: 'rgb(70, 70, 70)'
        };
    }

    _updateIndicators() {

        const oldIsActive = this._isActive;

        // set active state
        this._isActive = this._appButton.windows > 0;

        // no need to display indicators
        if (!this._config.enableIndicators || !this._isActive) {
            this._destroyIndicators();
            return;
        }

        // count the maximum number of indicators to display
        let maxIndicators = (
            this._appButton.windows > this._config.maxIndicators ?
            this._config.maxIndicators :
            this._appButton.windows
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // no need to change indicators
        if (indicatorsLength === maxIndicators) {

            if (oldIsActive !== this._isActive) {
                this._updateIndicatorsStyle();
            }

            return;
        }

        // check if some idicators should be destroyed
        // this will be executed in case we have more than one indicator
        if (indicatorsLength > maxIndicators) {

            let indicatorsToDestroy = this._indicators.splice(maxIndicators, indicatorsLength - maxIndicators);

            for (let i = 0, l = indicatorsToDestroy.length; i < l; ++i) {
                this._destroyIndicator(indicatorsToDestroy[i]);
            }

        } else {

            // don't create more than we need to display
            maxIndicators -= indicatorsLength;

            // create new indicators
            for (let i = 0; i < maxIndicators; ++i) {
                this._addIndicator();
            }
        }

        this._updateIndicatorsStyle();
    }

    _addIndicator() {

        if (!this._layout) {
            return;
        }

        if (!this._indicators) {
            this._indicators = [];
        }

        const indicator = new St.Bin({
            name: 'taskbar-appButton-indicator',
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            opacity: 0
        });

        this._indicators.push(indicator);

        this._layout.add_actor(indicator);

        indicator.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _updateIndicatorsStyle() {

        if (!this._indicators?.length) {
            return;
        }

        this._dominantColor = (
            (this._config.dominantColor || this._config.activeDominantColor) && this._appButton.dominantColor ?
            `rgb(${this._appButton.dominantColor.r}, ${this._appButton.dominantColor.g}, ${this._appButton.dominantColor.b})` :
            null
        );

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._indicators[i].style = this._getIndicatorStyle(i);
        }   
    }

    _getIndicatorStyle(index) {

        const backgroundColor = (
            this._isActive ? (this._config.activeDominantColor && this._dominantColor ? this._dominantColor : this._config.activeColor) :
                             (this._config.dominantColor && this._dominantColor ? this._dominantColor : this._config.color) 
        );

        let result = (
            `background-color: ${backgroundColor};` +
            `width: ${this._config.size}px;` +
            `height: ${this._config.size}px;` +
            `border-radius: ${this._config.size}px;`
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // check if no more indicators exist
        if (indicatorsLength <= 1) {
            return result;
        }

        // add margins when multiple idicators exist

        const margin = this._config.size + (this._config.size / 2);

        if (index === 0 || index < (indicatorsLength - 1)) {
            const marginOffset = indicatorsLength - 1 - index;
            result += `margin-right: ${margin * marginOffset}px;`;
        }

        if (index > 0) {
            result += `margin-left: ${margin * index}px;`;
        }

        return result;
    }

    _destroyIndicators() {

        if (!this._indicators?.length) {
            return;
        }

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._destroyIndicator(this._indicators[i]);
        }

        this._indicators = null;
    }

    _destroyIndicator(indicator) {

        if (!indicator) {
            return;
        } 

        indicator.remove_all_transitions();

        // no animation in this case
        if (!this._layout) {
            indicator.destroy();
            indicator = null;
            return;
        }

        indicator.ease({
            opacity: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                indicator.destroy();
                indicator = null;
            }
        });
    }

    _updateNotificationBadge() {

        const show = (
            this._config.enableNotificationBadges &&
            this._layout &&
            this._appButton.notifications > 0
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
            return;
        }

        this._notificationBadge = new St.Bin({
            name: 'taskbar-appButton-notification-badge',
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            opacity: 0
        });

        this._updateNotificationBadgeStyle();

        this._layout.add_actor(this._notificationBadge);

        this._notificationBadge.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _updateNotificationBadgeStyle() {

        if (!this._notificationBadge) {
            return;
        }

        this._notificationBadge.style = (
            `background-color: ${this._config.notificationBadgeColor};` +
            `width: ${this._config.notificationBadgeSize}px;` +
            `height: ${this._config.notificationBadgeSize}px;` +
            `border-radius: ${this._config.notificationBadgeSize}px;` +
            `border: 1px solid ${this._config.notificationBadgeBorderColor};` +
            `margin-right: ${this._config.notificationBadgeMargin}px;` +
            `margin-bottom: ${this._config.notificationBadgeMargin}px;`
        );
    }

    //#endregion private methods

}