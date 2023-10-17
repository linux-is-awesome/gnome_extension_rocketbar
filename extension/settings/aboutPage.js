import GObject from 'gi://GObject';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { SettingsPageTemplate } from './pageTemplate.js';

export const AboutPage = GObject.registerClass(
    class Rocketbar__AboutPage extends SettingsPageTemplate {

        _init(metadata) {
            super._init({
                title: _('About'),
                name: 'AboutPage',
                icon: 'help-about-symbolic'
            });

            this._metadata = metadata;

            this._createLayout();
        }

        _createLayout() {

            this.addGroup(null, [
                this.createLabel(this._metadata.name + _(' Version'),  this._metadata.version + '.0'),
                this.createLink(_('Release Notes'), this._metadata.url + '/releases')
            ]);

            this.addGroup(_('Useful Links'), [
                this.createLink(_('Report an issue'), this._metadata.url + '/issues'),
                this.createLink(_('Share your ideas'), this._metadata.url + '/discussions/categories/ideas')
            ]);

            this.addGroup(_('Credits'), [
                this.createLink('App Icons Taskbar', 'https://gitlab.com/AndrewZaech/aztaskbar'),
                this.createLink('Dash to Dock', 'https://github.com/micheleg/dash-to-dock'),
                this.createLink('Overview Clicking', 'https://github.com/mechtifs/overview-clicking'),
                this.createLink('Volume Scroller', 'https://github.com/trflynn89/gnome-shell-volume-scroller'),
                this.createLink('Fullscreen Hot Corner', 'https://github.com/soal/gnome-shell-fullscreen-hot-corner'),
                this.createLink('Just Perfection', 'https://gitlab.gnome.org/jrahmatzadeh/just-perfection')
            ]);
        }

    }
);
