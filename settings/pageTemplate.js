const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

// TODO
const _ = (text) => {
    return text;
};

var SettingsPageTemplate = GObject.registerClass(
    class SettingsPageTemplate extends Adw.PreferencesPage {

        _init(params) {
            super._init({
                title: _(params.title),
                name: params.name,
                icon_name: params.icon
            });
            this._settings = params.settings;
        }

        addGroup(title, options) {

            let newGroup = new Adw.PreferencesGroup({
                title: _(title)
            });

            this.add(newGroup);

            options?.forEach(option => newGroup.add(option));

            return newGroup;
        }

        createSwitch(title, settingsKey, subtitle) {

            let newSwitch = new Gtk.Switch({
                valign: Gtk.Align.CENTER
            });

            newSwitch.set_active(this._settings.get_boolean(settingsKey));

            newSwitch.connect('notify::active', (widget) => {
                this._settings.set_boolean(settingsKey, widget.get_active());
            });

            let switchRow = new Adw.ActionRow({
                title: _(title),
                subtitle: subtitle ? _(subtitle) : null,
                activatable_widget: newSwitch
            });

            switchRow.add_suffix(newSwitch);

            return switchRow;
        }

    }
);