const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var AboutPage = GObject.registerClass(
    class Rocketbar__AboutPage extends SettingsPageTemplate {

        _init() {
            super._init({
                title: 'About',
                name: 'AboutPage',
                icon: 'help-about-symbolic'
            });

            this._createLayout();
        }

        _createLayout() {

            const metadata = Me.metadata;

            this.addGroup(null, [
                this.createLabel(Me.metadata.name + ' Version',  Me.metadata.version + '.0')
            ]);

            this.addGroup('Useful Links', [
                this.createLink('Report bugs', metadata.url + '/issues'),
                this.createLink('Share your ideas', metadata.url + '/discussions/categories/ideas')
            ]);

            this.addGroup('Credits', [
                this.createLink('App Icons Taskbar', 'https://gitlab.com/AndrewZaech/aztaskbar'),
                this.createLink('Dash to Dock', 'https://github.com/micheleg/dash-to-dock'),
                this.createLink('Overview Clicking', 'https://github.com/mechtifs/overview-clicking'),
                this.createLink('Volume Scroller', 'https://github.com/trflynn89/gnome-shell-volume-scroller'),
                this.createLink('Fullscreen Hot Corner', 'https://github.com/soal/gnome-shell-fullscreen-hot-corner'),
            ]);
        }

    }
);