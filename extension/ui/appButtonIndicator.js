/* exported AppButtonIndicator */

//#region imports

import Clutter from 'gi://Clutter';
import St from 'gi://St';

// custom modules import
import { Config } from '../utils/config.js';
import { Connections } from '../utils/connections.js';

//#endregion imports

export class AppButtonIndicator {

    constructor(appButton, layout, settings) {

        this._appButton = appButton;
        this._layout = layout;
        this._settings = settings;
        this._indicators = null;
        this._isActive = false;
        this._dominantColor = null;

        this._handleSettings();

        this._createConnections();
    }

    //#region public methods

    destroy() {

        this._layout = null;

        this._connections?.destroy();

        this._destroyIndicators();
    }

    rerender() {
        this._updateIndicators();
    }

    updateStyle() {
        this._updateIndicatorsStyle();
    }

    //#endregion public methods

    //#region private methods

    _createConnections() {
        this._connections = new Connections();
        this._connections.addScope(this._settings, [
            'changed::indicator-width-inactive',
            'changed::indicator-width-active',
            'changed::indicator-height-inactive',
            'changed::indicator-height-active',
            'changed::indicator-roundness-inactive',
            'changed::indicator-roundness-active',
            'changed::indicator-spacing-inactive',
            'changed::indicator-spacing-active',
            'changed::indicator-dominant-color-active',
            'changed::indicator-dominant-color-inactive',
            'changed::indicator-color-active',
            'changed::indicator-color-inactive',
            'changed::indicator-position',
            'changed::indicator-display-limit'], () => this._handleSettings());
    }

    _handleSettings() {

        if (this._config) {
            this._config.update();
        } else {
            this._setConfig();
        }

        this._config.handleChanged(['maxIndicators'], () => this.rerender());

        if (!this._config.hasOld()) {
            return;
        }

        this._config.handleChanged([
            'width',
            'activeWidth',
            'height',
            'activeHeight',
            'roundness',
            'activeRoundness',
            'spacing',
            'activeSpacing',
            'dominantColor',
            'activeDominantColor',
            'color',
            'activeColor',
            'position'
        ], () => this._updateIndicatorsStyle());
    }

    _setConfig() {
        this._config = new Config(() => ({
            width: this._settings.get_int('indicator-width-inactive'),
            activeWidth: this._settings.get_int('indicator-width-active'),
            height: this._settings.get_int('indicator-height-inactive'),
            activeHeight: this._settings.get_int('indicator-height-active'),
            roundness: this._settings.get_int('indicator-roundness-inactive'),
            activeRoundness: this._settings.get_int('indicator-roundness-active'),
            spacing: this._settings.get_int('indicator-spacing-inactive'),
            activeSpacing: this._settings.get_int('indicator-spacing-active'),
            color: this._settings.get_string('indicator-color-inactive'),
            activeColor: this._settings.get_string('indicator-color-active'),
            position: this._settings.get_string('indicator-position'),
            dominantColor: this._settings.get_boolean('indicator-dominant-color-inactive'),
            activeDominantColor: this._settings.get_boolean('indicator-dominant-color-active'),
            maxIndicators: this._settings.get_int('indicator-display-limit')
        }));
    }

    _updateIndicators() {

        const oldIsActive = this._isActive;

        // set active state
        this._isActive = this._appButton.isActive;

        // no need to display indicators
        if (!this._appButton.windows) {
            this._destroyIndicators();
            return;
        }

        // count the maximum number of indicators to display
        let maxIndicators = (
            this._appButton.windows > this._config.values.maxIndicators ?
            this._config.values.maxIndicators :
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

        this._layout.add_child(indicator);

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

        const config = this._config.values;

        this._dominantColor = (
            (config.dominantColor || config.activeDominantColor) && this._appButton.dominantColor ?
            `rgb(${this._appButton.dominantColor.r}, ${this._appButton.dominantColor.g}, ${this._appButton.dominantColor.b})` :
            null
        );

        const position = (
            config.position === 'top' ?
            Clutter.ActorAlign.START :
            Clutter.ActorAlign.END
        );

        for (let i = 0, l = this._indicators.length; i < l; ++i) {
            this._indicators[i].style = this._getIndicatorStyle(i);
            this._indicators[i].y_align = position;
        }   
    }

    _getIndicatorStyle(index) {

        const config = this._config.values;

        const backgroundColor = (
            this._isActive ? (config.activeDominantColor && this._dominantColor ? this._dominantColor : config.activeColor) :
                             (config.dominantColor && this._dominantColor ? this._dominantColor : config.color) 
        );

        const [ width, height, roundness, spacing ] = (
            this._isActive ? [ config.activeWidth, config.activeHeight, config.activeRoundness, config.activeSpacing ] :
                             [ config.width, config.height, config.roundness, config.spacing ]
        );


        let result = (
            `background-color: ${backgroundColor};` +
            `width: ${width}px;` +
            `height: ${height}px;` +
            `border-radius: ${roundness}px;`
        );

        const indicatorsLength = this._indicators?.length || 0; 

        // check if no more indicators exist
        if (indicatorsLength <= 1) {
            return result;
        }

        // add margins when multiple idicators exist

        const margin = width + spacing;

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

    //#endregion private methods

}
