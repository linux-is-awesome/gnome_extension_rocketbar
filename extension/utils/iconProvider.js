/* exported IconProvider */

import Gio from 'gi://Gio';
import St from 'gi://St';
import Gtk from 'gi://Gtk';

export class IconProvider {
    constructor(extensionPath) {
        this._iconTheme = new Gtk.IconTheme();
        this._assetsPath = `${extensionPath}/assets/icons/`;
    }

    getIcon(iconName, iconSize) {

        const iconInfo = this.getIconInfo(iconName, iconSize);

        if (iconInfo) {
            let iconPath = null;
            if (iconInfo.get_filename) {
                iconPath = iconInfo.get_filename();
            } else if (iconInfo.get_file) {
                iconPath = iconInfo.get_file().get_path();
            }

            if (iconPath) {
                return Gio.Icon.new_for_string(iconPath);
            }
        }

        return this.getCustomIcon(this._assetsPath + iconName + '.svg');
    }

    getIconInfo(iconName, iconSize) {
        if (this._iconTheme.set_custom_theme) {
            this._iconTheme.set_custom_theme(St.Settings.get().gtkIconTheme);
            return this._iconTheme.lookup_icon(iconName, iconSize, 0);
        } else if (this._iconTheme.set_theme_name) {
            this._iconTheme.set_theme_name(St.Settings.get().gtkIconTheme);
            return this._iconTheme.lookup_icon(iconName, null, iconSize, 1, 1, 1);
        }
        return null;
    }

    getCustomIcon(iconPath) {

        if (!iconPath || !iconPath.length) {
            return null;
        }

        // a simple validation to check that the iconPath looks like a real path
        // NOTE: it's not the safest way to validate the icon, but it's fast
        if (!iconPath.startsWith('/') || !(
            // only .png and .svg files supported for now
            iconPath.endsWith('.png') ||
            iconPath.endsWith('.svg')
        )) {
            return null;
        }

        // check that the path exists
        const iconFile = Gio.File.new_for_path(iconPath);

        if (!iconFile.query_exists(null)) {
            return null;
        }

        // create GIcon if everything looks fine
        return Gio.Icon.new_for_string(iconFile.get_path());
    }

}
