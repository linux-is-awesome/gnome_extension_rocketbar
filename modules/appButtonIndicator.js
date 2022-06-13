const { Clutter, St } = imports.gi;

var AppButtonIndicator = class AppButtonIndicator {

    constructor(parent, settings) {
        this._parent = parent;
        this._settings = settings;
        this._indicators = null;
        this._isActive = false;
        this._dominantColor = null;

        this._setConfig();
    }

    //#region public methods

    destroy() {

        this._parent = null;

        this._destroyIndicators();
    }

    update(windows = [], isActive) {

        const oldIsActive = this._isActive;

        // set active state
        this._isActive = isActive;

        // no need to display indicators
        if (!windows.length) {
            this._destroyIndicators();
            return;
        }

        // count the maximum number of indicators to display
        let maxIndicators = (
            windows.length > this._config.maxIndicators ?
            this._config.maxIndicators :
            windows.length
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // no need to change indicators
        if (indicatorsLength === maxIndicators) {

            if (oldIsActive !== this._isActive) {
                this.rerender();
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

        this.rerender();
    }

    setDominantColor(rgb) {

        this._dominantColor = (
            rgb ?
            `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` :
            null
        );

        this.rerender();
    }

    rerender() {

        if (!this._indicators?.length) {
            return;
        }

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._indicators[i].style = this._getIndicatorStyle(i);
        }   
    }

    //#endregion public methods

    //#region private methods

    _setConfig() {
        this._config = {
            color: 'rgb(255, 255, 255)',
            activeColor: 'rgb(53, 132, 228)',
            dominantColor: true,
            activeDominantColor: true,
            size: 4,
            maxIndicators: 2
        };
    }

    _addIndicator() {

        if (!this._parent) {
            return;
        }

        if (!this._indicators) {
            this._indicators = [];
        }

        const indicatorIndex = this._indicators.length;

        const indicator = new St.Bin({
            name: 'taskbar-appButton-indicator',
            x_expand: false,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
            opacity: 0
        });

        this._indicators.push(indicator);

        this._parent.add_actor(indicator);

        indicator.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
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
        if (!this._parent) {
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

    //#endregion private methods

}