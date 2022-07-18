const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

const _ = imports.misc.extensionUtils.gettext;

var CustomizePage = GObject.registerClass(
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
            return this.addGroup(_('App Buttons'), [
                this.createSlider(
                    _('Icon Size'), 'appbutton-icon-size',
                    { min: 16, max: 64, marks: [16, 24, 32, 48, 64] },
                    _('Can be configured separately for each app via an app menu')
                ),
                this.createSpinButton(
                    _('Icon Padding'), 'appbutton-icon-padding',
                    { min: 0, max: 20 }
                ),
                this.createSpinButton(
                    _('Vertical Margin'), 'appbutton-vertical-margin',
                    { min: 0, max: 10 }
                ),
                this.createSpinButton(
                    _('Roundness'), 'appbutton-roundness',
                    { min: 0, max: 100 }
                ),
                this.createSpinButton(
                    _('Spacing'), 'appbutton-spacing',
                    { min: 0, max: 10 }
                ),
                this.createSwitch(_('Dominant Color Backlight'), 'appbutton-backlight'),
                ...this.addVisibilityControl([
                    this.createSpinButton(
                        _('Backlight Intensity'), 'appbutton-backlight-intensity',
                        { min: 1, max: 9 }
                    )
                ], { 'appbutton-backlight': value => value })
            ]);
        }

        _addIndicatorOptions() {

            const positionOptions = [
                { label: _('Top'), value: 'top' },
                { label: _('Bottom'), value: 'bottom' }
            ];

            return this.addGroup(_('Indicators'), [
                this.createSwitch(_('Active Dominant Color'), 'indicator-dominant-color-active'),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Active Color'), 'indicator-color-active')
                ], { 'indicator-dominant-color-active': value => !value }),
                this.createSwitch(_('Inactive Dominant Color'), 'indicator-dominant-color-inactive'),
                ...this.addVisibilityControl([
                    this.createColorButton(_('Inactive Color'), 'indicator-color-inactive')
                ], { 'indicator-dominant-color-inactive': value => !value }),
                this.createPicklist(
                    _('Position'), 'indicator-position',
                    positionOptions
                ),
                this.createSpinButton(
                    _('Size'), 'indicator-size',
                    { min: 2, max: 10 }
                ),
                this.createSpinButton(
                    _('Limit'), 'indicator-display-limit',
                    { min: 1, max: 5 },
                    _('The maximum number of indicators to display on the app button')
                )
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
                )
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