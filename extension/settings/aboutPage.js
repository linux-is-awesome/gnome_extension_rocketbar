const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { SettingsPageTemplate } = Me.imports.settings.pageTemplate;

var AboutPage = GObject.registerClass(
    class AboutPage extends SettingsPageTemplate {

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
                this.createLink('Report bugs', metadata.url + '/issues'),
                this.createLink('Share your ideas', metadata.url + '/discussions/categories/ideas')
            ]);
        }

    }
);