const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

// TODO
const _ = (text) => {
    return text;
};

var GeneralPage = GObject.registerClass(
    class GeneralPage extends Adw.PreferencesPage {

        _init(settings) {
            super._init({
                title: _('General'),
                name: 'GeneralPage',
                icon_name: 'preferences-system-symbolic'
            });

            this._settings = settings;

            // Taskbar
            this._createTaskbarGroup();
        }

        _createTaskbarGroup() {

            let taskbarGroup = new Adw.PreferencesGroup({
                title: _('Taskbar')
            });

            this.add(taskbarGroup);

            // Show Favorites

            let showFavoritesSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            showFavoritesSwitch.set_active(this._settings.get_boolean('taskbar-show-favorites'));
    
            showFavoritesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('taskbar-show-favorites', widget.get_active());
            });

            let showFavoritesRow = new Adw.ActionRow({
                title: _('Show Favorites'),
                activatable_widget: showFavoritesSwitch
            });

            showFavoritesRow.add_suffix(showFavoritesSwitch);

            taskbarGroup.add(showFavoritesRow);

            // Isolate Workspaces

            let isolateWorkspacesSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            isolateWorkspacesSwitch.set_active(this._settings.get_boolean('taskbar-isolate-workspaces'));

            isolateWorkspacesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('taskbar-isolate-workspaces', widget.get_active());
            });

            let isolateWorkspacesRow = new Adw.ActionRow({
                title: _('Isolate Workspaces'),
                activatable_widget: isolateWorkspacesSwitch
            });

            isolateWorkspacesRow.add_suffix(isolateWorkspacesSwitch);

            taskbarGroup.add(isolateWorkspacesRow);

            // Enable Tooltips

            let enableTooltipsSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            enableTooltipsSwitch.set_active(this._settings.get_boolean('appbutton-enable-tooltips'));

            enableTooltipsSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('appbutton-enable-tooltips', widget.get_active());
            });

            let enableTooltipsSwitchRow = new Adw.ActionRow({
                title: _('Enable Tooltips'),
                activatable_widget: enableTooltipsSwitch
            });

            enableTooltipsSwitchRow.add_suffix(enableTooltipsSwitch);

            taskbarGroup.add(enableTooltipsSwitchRow);

            // Enable Indicators

            let enableIndicatorsSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            enableIndicatorsSwitch.set_active(this._settings.get_boolean('appbutton-enable-indicators'));

            enableIndicatorsSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('appbutton-enable-indicators', widget.get_active());
            });

            let enableIndicatorsSwitchRow = new Adw.ActionRow({
                title: _('Enable Indicators'),
                activatable_widget: enableIndicatorsSwitch
            });

            enableIndicatorsSwitchRow.add_suffix(enableIndicatorsSwitch);

            taskbarGroup.add(enableIndicatorsSwitchRow);

            // Enable Notification Badges

            let enableNotificationBadgesSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            enableNotificationBadgesSwitch.set_active(this._settings.get_boolean('appbutton-enable-notification-badges'));

            enableNotificationBadgesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('appbutton-enable-notification-badges', widget.get_active());
            });

            let enableNotificationBadgesSwitchRow = new Adw.ActionRow({
                title: _('Enable Notification Badges'),
                activatable_widget: enableNotificationBadgesSwitch
            });

            enableNotificationBadgesSwitchRow.add_suffix(enableNotificationBadgesSwitch);

            taskbarGroup.add(enableNotificationBadgesSwitchRow);
        }

    }
);