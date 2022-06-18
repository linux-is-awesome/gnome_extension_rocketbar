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

            let showFavoritesRow = new Adw.ActionRow({
                title: _('Show Favorites'),
                activatable_widget: showFavoritesSwitch
            });

            showFavoritesSwitch.set_active(this._settings.get_boolean('taskbar-show-favorites'));
    
            showFavoritesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('taskbar-show-favorites', widget.get_active());
            });

            showFavoritesRow.add_suffix(showFavoritesSwitch);

            taskbarGroup.add(showFavoritesRow);

            // Isolate Workspaces

            let isolateWorkspacesSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });
    
            let isolateWorkspacesRow = new Adw.ActionRow({
                title: _('Isolate Workspaces'),
                activatable_widget: isolateWorkspacesSwitch
            });

            isolateWorkspacesSwitch.set_active(this._settings.get_boolean('taskbar-isolate-workspaces'));

            isolateWorkspacesSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean('taskbar-isolate-workspaces', widget.get_active());
            });

            isolateWorkspacesRow.add_suffix(isolateWorkspacesSwitch);

            taskbarGroup.add(isolateWorkspacesRow);
        }

    }
);