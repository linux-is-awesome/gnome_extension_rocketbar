const { Adw, Gio, GLib, GObject, Gtk } = imports.gi;

// TODO
const _ = (text) => {
    return text;
};

var BehaviorPage = GObject.registerClass(
    class BehaviorPage extends Adw.PreferencesPage {

        _init(settings) {
            super._init({
                title: _('Behavior'),
                name: 'BehaviorPage',
                icon_name: 'applications-engineering-symbolic'
            });
        }

    }
);