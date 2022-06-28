const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var CustomizePage = GObject.registerClass(
    class Rocketbar__CustomizePage extends SettingsPageTemplate {

        _init(settings) {

            super._init({
                title: 'Customize',
                name: 'CustomizePage',
                icon: 'applications-utilities-symbolic',
                settings: settings
            });

            this._options = [];

            this._emptyMessage = this.addGroup(null, [
                this.createMessage('No customizations available')
            ]);

            this._emptyMessage.hide();

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

            this._options = this._options.concat(taskbarRelatedOptions);

            // handle settings changes in order to hide some options

            const toggleTaskbarRelatedOptions = () => {

                if (!this._settings.get_boolean('taskbar-enabled')) {
                    taskbarRelatedOptions.forEach(options => options.hide());
                } else {

                    taskbarOptions.show();
                    appButtonOptions.show();

                    if (!this._settings.get_boolean('appbutton-enable-indicators')) {
                        indicatorOptions.hide();
                    } else {
                        indicatorOptions.show();
                    }

                    if (!this._settings.get_boolean('appbutton-enable-notification-badges')) {
                        notificationBadgeOptions.hide();
                    } else {
                        notificationBadgeOptions.show();
                    }

                    if (!this._settings.get_boolean('appbutton-enable-tooltips')) {
                        tooltipOptions.hide();
                    } else {
                        tooltipOptions.show();
                    }

                }

                this._toggleEmptyMessage();
            };

            toggleTaskbarRelatedOptions();

            this._settings.connect('changed::taskbar-enabled', () => toggleTaskbarRelatedOptions());

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
                ),
                this.createSwitch('Preserve Position', 'taskbar-preserve-position',
                                  'Prevent position changes caused by other extensions in the panel')
            ]);
        }

        _addAppButtonOptions() {

            const backlightSwitch = this.createSwitch('Dominant Color Backlight', 'appbutton-backlight');

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

            const activeColorButton = this.createColorButton('Active Color', 'indicator-color-active');

            if (this._settings.get_boolean('indicator-dominant-color-active')) {
                activeColorButton.hide();
            }

            this._settings.connect('changed::indicator-dominant-color-active', () => {
                if (this._settings.get_boolean('indicator-dominant-color-active')) {
                    activeColorButton.hide();
                    return;
                }
                activeColorButton.show();
            });

            const inactiveColorButton = this.createColorButton('Inactive Color', 'indicator-color-inactive');

            if (this._settings.get_boolean('indicator-dominant-color-inactive')) {
                inactiveColorButton.hide();
            }

            this._settings.connect('changed::indicator-dominant-color-inactive', () => {
                if (this._settings.get_boolean('indicator-dominant-color-inactive')) {
                    inactiveColorButton.hide();
                    return;
                }
                inactiveColorButton.show();
            });

            return this.addGroup('Indicators', [
                this.createSwitch('Active Dominant Color', 'indicator-dominant-color-active'),
                activeColorButton,
                this.createSwitch('Inactive Dominant Color', 'indicator-dominant-color-inactive'),
                inactiveColorButton,
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
                this.createColorButton('Color', 'notification-badge-color'),
                this.createColorButton('Border Color', 'notification-badge-border-color'),
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

        _toggleEmptyMessage() {
            const visibleOptions = this._options.filter(option => option.visible);

            if (visibleOptions.length) {
                this._emptyMessage.hide();
                return;
            }

            this._emptyMessage.show();
        }

    }
);