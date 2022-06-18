const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

// TODO
const _ = (text) => {
    return text;
};

var AboutPage = GObject.registerClass(
    class AboutPage extends Adw.PreferencesPage {

        _init() {
            super._init({
                title: _('About'),
                name: 'AboutPage',
                icon_name: 'help-about-symbolic'
            });
        }

    }
);