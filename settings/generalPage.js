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
        }

    }
);