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

        createPicklist(title, settingsKey, options, subtitle) {

            let stringOptions = false;
            let values = [];
            let picklistOptions = new Gtk.StringList();

            options.forEach((option) => {

                if (!stringOptions) {
                    stringOptions = !Number.isInteger(option.value);
                }

                values.push(option.value);

                picklistOptions.append(_(option.label))
            });

            let selectedIndex = values.indexOf(
                stringOptions ?
                this._settings.get_string(settingsKey) :
                this._settings.get_int(settingsKey)
            );

            let picklistRow = new Adw.ComboRow({
                title: _(title),
                model: picklistOptions,
                selected: selectedIndex >= 0 ? selectedIndex : 0
            });

            picklistRow.connect("notify::selected", (widget) => {

                let value = values[widget.selected];

                if (stringOptions) {
                    this._settings.set_string(settingsKey, value);
                    return;
                }
                
                this._settings.set_int(settingsKey, value);
            });

            return picklistRow;
        }

    }
);