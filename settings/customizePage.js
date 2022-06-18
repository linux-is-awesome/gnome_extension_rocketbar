const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

// TODO
const _ = (text) => {
    return text;
};

var CustomizePage = GObject.registerClass(
    class CustomizePage extends Adw.PreferencesPage {

        _init(settings) {
            super._init({
                title: _('Customize'),
                name: 'CustomizePage',
                icon_name: 'applications-utilities-symbolic'
            });
        }

    }
);