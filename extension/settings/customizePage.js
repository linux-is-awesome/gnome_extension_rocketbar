import GObject from 'gi://GObject';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { SettingsPageTemplate } from './pageTemplate.js';

export const CustomizePage = GObject.registerClass(
    class Rocketbar__CustomizePage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: _('Customize'),
                name: 'CustomizePage',
                icon: 'applications-utilities-symbolic',
                settings: settings
            });

            this._options = [];

            this._emptyMessage = this.addGroup(null, [
                this.createMessage(_('No customizations available'))
            ]);

            this._populateOptions();

            this._toggleEmptyMessage();
        }

        _populateOptions() {

            // create sections in the order we want to see them on the UI
            const taskbarOptions = this._addTaskbarOptions();
            const appButtonOptions = this._addAppButtonOptions();
            const indicatorOptions = this._addIndicatorOptions();
            const notificationBadgeOptions = this._addNotificationBadgeOptions();
            const tooltipOptions = this._addTooltipOptions();

            this._options = [...this._options, ...this.addVisibilityControl([
                taskbarOptions,
                appButtonOptions,
                indicatorOptions,
                notificationBadgeOptions,
                tooltipOptions
            ], {
                'taskbar-enabled': value => value,
                'appbutton-enable-indicators': null,
                'appbutton-enable-notification-badges': null,
                'appbutton-enable-tooltips': null
            }, option => {

                if (!option) {
                    this._toggleEmptyMessage();
                    return;
                }

                if (!option.visible) {
                    return;
                }

                let settingsKey = null;
                
                if (option === indicatorOptions) {
                    settingsKey = 'appbutton-enable-indicators';
                } else if (option === notificationBadgeOptions) {
                    settingsKey = 'appbutton-enable-notification-badges';
                } else if (option === tooltipOptions) {
                    settingsKey = 'appbutton-enable-tooltips';
                } else return;

                option.visible = this._settings.get_boolean(settingsKey);

            }), ...this.addVisibilityControl([
                this._addNotificationCounterOptions()
            ], {
                'notification-counter-enabled': value => value
            }, option => {
                if (!option) {
                    this._toggleEmptyMessage();
                }
            })];
        }

        _addTaskbarOptions() {

            const positionOptions = [
                { label: _('Left'), value: 'left' },
                { label: _('Center'), value: 'center' },
                { label: _('Right'), value: 'right' }
            ];

            return this.addGroup(_('Taskbar'), [
                this.createPicklist(
                    _('Position'), 'taskbar-position',
                    positionOptions
                ),
                this.createSpinButton(
                    _('Position Offset'), 'taskbar-position-offset',
                    { min: 0, max: 15 }
                ),
                this.createSwitch(_('Preserve Position'), 'taskbar-preserve-position',
                                  _('Prevent position changes caused by other extensions in the panel'))
            ]);
        }

        _addAppButtonOptions() {

            const backlightColorRow = this.createColorButton(_('Backlight Color'), 'appbutton-backlight-color');
            backlightColorRow.activatable_widget.use_alpha = false;

            return this.addGroup(_('App Buttons'), [
                this.createSlider(
                    _('Icon Size'), 'appbutton-icon-size',
                    { min: 16, max: 64, marks: [16, 24, 32, 48, 64] },
                    _('Can be configured separately for each app via an app menu')
                ),
                this.createSpinButton(
                    _('Icon Horizontal Padding'), 'appbutton-icon-padding',
                    { min: 0, max: 20 }
                ),
                this.createSpinButton(
                    _('Icon Vertical Padding'), 'appbutton-icon-vertical-padding',
                    { min: 0, max: 20 }
                ),
                this.createSpinButton(
                    _('Roundness'), 'appbutton-roundness',
                    { min: 0, max: 100 }
                ),
                this.createSpinButton(
                    _('Spacing'), 'appbutton-spacing',
                    { min: 0, max: 10 }
                ),
                this.createSwitch(_('Dominant Color Backlight'), 'appbutton-backlight-dominant-color'),
                ...this.addVisibilityControl([
                    backlightColorRow
                ], { 'appbutton-backlight-dominant-color': value => !value }),
                this.createSpinButton(
                    _('Backlight Intensity'), 'appbutton-backlight-intensity',
                    { min: 0, max: 9 }
                )
            ]);
        }

        _addIndicatorOptions() {

            const positionOptions = [
                { label: _('Top'), value: 'top' },
                { label: _('Bottom'), value: 'bottom' }
            ];

            return this.addGroup(_('Indicators'), [
                this.createPicklist(
                    _('Position'), 'indicator-position',
                    positionOptions
                ),
                this.createSpinButton(
                    _('Limit'), 'indicator-display-limit',
                    { min: 1, max: 5 },
                    _('The maximum number of indicators to display on top of app buttons')
                ),
                this.createSwitch(_('Active Dominant Color'), 'indicator-dominant-color-active'),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Active Color'), 'indicator-color-active')
                ], { 'indicator-dominant-color-active': value => !value }),
                this.createSwitch(_('Inactive Dominant Color'), 'indicator-dominant-color-inactive'),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Inactive Color'), 'indicator-color-inactive')
                ], { 'indicator-dominant-color-inactive': value => !value }),

                this.createSpinButton(
                    _('Inactive Width'), 'indicator-width-inactive',
                    { min: 1, max: 100 }
                ),
                this.createSpinButton(
                    _('Active Width'), 'indicator-width-active',
                    { min: 1, max: 100 }
                ),
                this.createSpinButton(
                    _('Inactive Height'), 'indicator-height-inactive',
                    { min: 1, max: 100 }
                ),
                this.createSpinButton(
                    _('Active Height'), 'indicator-height-active',
                    { min: 1, max: 100 }
                ),
                this.createSpinButton(
                    _('Inactive Roundness'), 'indicator-roundness-inactive',
                    { min: 0, max: 100 }
                ),
                this.createSpinButton(
                    _('Active Roundness'), 'indicator-roundness-active',
                    { min: 0, max: 100 }
                ),
                ...this.addVisibilityControl([
                    this.createSpinButton(
                        _('Inactive Spacing'), 'indicator-spacing-inactive',
                        { min: 0, max: 50 }
                    ),
                    this.createSpinButton(
                        _('Active Spacing'), 'indicator-spacing-active',
                        { min: 0, max: 50 }
                    )
                ], { 'indicator-display-limit': value => value > 1 })
            ]);
        }

        _addNotificationBadgeOptions() {

            const positionOptions = [
                { label: _('Top Left'), value: 'top_left' },
                { label: _('Top Right'), value: 'top_right' },
                { label: _('Bottom Left'), value: 'bottom_left' },
                { label: _('Bottom Right'), value: 'bottom_right' }
            ];

            return this.addGroup(_('Notification Badges'), [
                this.createColorButton(_('Color'), 'notification-badge-color'),
                this.createColorButton(_('Border Color'), 'notification-badge-border-color'),
                this.createPicklist(
                    _('Position'), 'notification-badge-position',
                    positionOptions
                ),
                this.createSpinButton(
                    _('Size'), 'notification-badge-size',
                    { min: 2, max: 10 }
                ),
                this.createSpinButton(
                    _('Margin'), 'notification-badge-margin',
                    { min: 0, max: 15 }
                )
            ]);
        }

        _addTooltipOptions() {
            return this.addGroup(_('Tooltips'), [
                this.createSpinButton(
                    _('Show Delay'), 'tooltip-show-delay',
                    { min: 100, max: 2000, step: 100 }
                ),
                this.createSpinButton(
                    _('Max Width'), 'tooltip-max-width',
                    { min: 200, max: 1000, step: 50 }
                )
            ]);
        }

        _addNotificationCounterOptions() {
            return this.addGroup(_('Notification Counter'), [
                this.createSwitch(_('Hide when empty'), 'notification-counter-hide-empty'),
                this.createSwitch(_('Center clock'), 'notification-counter-center-clock'),
                this.createSpinButton(
                    _('Max Count'), 'notification-counter-max-count',
                    { min: 1, max: 999 }
                ),
                this.createSpinButton(
                    _('Font Size'), 'notification-counter-font-size',
                    { min: 8, max: 20 }
                ),
                this.createSpinButton(
                    _('Roundness'), 'notification-counter-roundness',
                    { min: 0, max: 50 }
                ),
                this.createSpinButton(
                    _('Top Margin'), 'notification-counter-margin-top',
                    { min: 0, max: 10 }
                ),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Empty Color'), 'notification-counter-color-empty')
                ], { 'notification-counter-hide-empty': value => !value }),
                this.createColorButton(_('Not Empty Color'), 'notification-counter-color-not-empty'),
                this.createColorButton(_('Text Color'), 'notification-counter-text-color'),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Do Not Disturb - Empty Color'), 'notification-counter-color-empty-dnd'),
                ], { 'notification-counter-hide-empty': value => !value }),
                this.createColorButton(_('Do Not Disturb - Not Empty Color'), 'notification-counter-color-not-empty-dnd'),
                this.createColorButton(_('Do Not Disturb - Text Color'), 'notification-counter-text-color-dnd'),
            ]);
        }

        _toggleEmptyMessage() {

            if (!this._options.length) {
                return;
            }

            const visibleOptions = this._options.filter(option => option.visible);

            if (visibleOptions.length) {
                this._emptyMessage.hide();
                return;
            }

            this._emptyMessage.show();
        }

    }
);
