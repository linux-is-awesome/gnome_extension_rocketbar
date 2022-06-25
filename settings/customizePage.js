const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var CustomizePage = GObject.registerClass(
    class CustomizePage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: 'Customize',
                name: 'CustomizePage',
                icon: 'applications-utilities-symbolic',
                settings: settings
            });

            this._populateOptions();
        }

        _populateOptions() {

            const taskbarOptions = this._addTaskbarOptions();
            const appButtonOptions = this._addAppButtonOptions();
            const indicatorOptions = this._addIndicatorOptions();
            const notificationBadgeOptions = this._addNotificationBadgeOptions();
            const tooltipOptions = this._addTooltipOptions();

            const taskbarRelatedOptions = [
                taskbarOptions,
                appButtonOptions,
                indicatorOptions,
                notificationBadgeOptions,
                tooltipOptions
            ];

            // handle settings changes in order to hide some options

            if (!this._settings.get_boolean('taskbar-enabled')) {
                taskbarRelatedOptions.forEach(options => options.hide());
            } else {

                if (!this._settings.get_boolean('appbutton-enable-indicators')) {
                    indicatorOptions.hide();
                }

                if (!this._settings.get_boolean('appbutton-enable-notification-badges')) {
                    notificationBadgeOptions.hide();
                }

                if (!this._settings.get_boolean('appbutton-enable-tooltips')) {
                    tooltipOptions.hide();
                }

            }

            this._settings.connect('changed::taskbar-enabled', () => {

                if (!this._settings.get_boolean('taskbar-enabled')) {
                    taskbarRelatedOptions.forEach(options => options.hide());
                    return;
                }

                taskbarOptions.show();
                appButtonOptions.show();

                if (this._settings.get_boolean('appbutton-enable-indicators')) {
                    indicatorOptions.show();
                }

                if (this._settings.get_boolean('appbutton-enable-notification-badges')) {
                    notificationBadgeOptions.show();
                }

                if (this._settings.get_boolean('appbutton-enable-tooltips')) {
                    tooltipOptions.show();
                }

            });

            this._settings.connect('changed::appbutton-enable-indicators', () => {
                if (!this._settings.get_boolean('appbutton-enable-indicators')) {
                    indicatorOptions.hide();
                    return;
                }
                indicatorOptions.show();
            });

            this._settings.connect('changed::appbutton-enable-notification-badges', () => {
                if (!this._settings.get_boolean('appbutton-enable-notification-badges')) {
                    notificationBadgeOptions.hide();
                    return;
                }
                notificationBadgeOptions.show();
            });

            this._settings.connect('changed::appbutton-enable-tooltips', () => {
                if (!this._settings.get_boolean('appbutton-enable-tooltips')) {
                    tooltipOptions.hide();
                    return;
                }
                tooltipOptions.show();
            });
        }

        _addTaskbarOptions() {

            const positionOptions = [
                { label: 'Left', value: 'left' },
                { label: 'Center', value: 'center' },
                { label: 'Right', value: 'right' }
            ];

            return this.addGroup('Taskbar', [
                this.createPicklist(
                    'Position', 'taskbar-position',
                    positionOptions
                ),
                this.createSpinButton(
                    'Position Offset', 'taskbar-position-offset',
                    { min: 0, max: 15 }
                )
            ]);
        }

        _addAppButtonOptions() {

            const backlightSwitch = this.createSwitch('Dominant color backlight', 'appbutton-backlight');

            const backlightIntensitySlider = this.createSlider('Backlight Intensity', 'appbutton-backlight-intensity', {
                min: 1, max: 9
            });

            backlightSwitch.activatable_widget.connect('notify::active', widget => {
                if (widget.get_active()) {
                    backlightIntensitySlider.show();
                    return;
                }
                backlightIntensitySlider.hide();
            });

            return this.addGroup('App Buttons', [
                backlightSwitch,
                backlightIntensitySlider,
                this.createSlider(
                    'Icon Size', 'appbutton-icon-size',
                    { min: 16, max: 64, marks: [16, 24, 32, 48, 64] }
                ),
                this.createSlider(
                    'Icon Padding', 'appbutton-icon-padding',
                    { min: 0, max: 20 }
                ),
                this.createSlider(
                    'Vertical Margin', 'appbutton-vertical-margin',
                    { min: 0, max: 10 }
                ),
                this.createSlider(
                    'Roundness', 'appbutton-roundness',
                    { min: 0, max: 100 }
                ),
                this.createSlider(
                    'Spacing', 'appbutton-spacing',
                    { min: 0, max: 10 }
                )
            ]);
        }

        _addIndicatorOptions() {

            const positionOptions = [
                { label: 'Top', value: 'top' },
                { label: 'Bottom', value: 'bottom' }
            ];

            return this.addGroup('Indicators', [
                this.createSwitch('Active dominant color', 'indicator-dominant-color-active'),
                this.createSwitch('Inactive dominant color', 'indicator-dominant-color-inactive'),
                this.createPicklist(
                    'Position', 'indicator-position',
                    positionOptions
                ),
                this.createSlider(
                    'Size', 'indicator-size',
                    { min: 2, max: 10 }
                ),
                this.createSlider(
                    'Idicators to display limit', 'indicator-display-limit',
                    { min: 1, max: 5 }
                )
            ]);
        }

        _addNotificationBadgeOptions() {

            const positionOptions = [
                { label: 'Top Left', value: 'top_left' },
                { label: 'Top Right', value: 'top_right' },
                { label: 'Bottom Left', value: 'bottom_left' },
                { label: 'Bottom Right', value: 'bottom_right' }
            ];

            return this.addGroup('Notification Badges', [
                this.createPicklist(
                    'Position', 'notification-badge-position',
                    positionOptions
                ),
                this.createSlider(
                    'Size', 'notification-badge-size',
                    { min: 2, max: 10 }
                ),
                this.createSlider(
                    'Margin', 'notification-badge-margin',
                    { min: 0, max: 15 }
                )
            ]);
        }

        _addTooltipOptions() {
            return this.addGroup('Tooltips', [
                this.createSpinButton(
                    'Show Delay', 'tooltip-show-delay',
                    { min: 100, max: 2000, step: 100 }
                )
            ]);
        }

    }
);