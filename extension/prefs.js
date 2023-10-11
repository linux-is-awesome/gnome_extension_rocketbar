import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { GeneralPage } from './settings.generalPage.js';
import { CustomizePage } from './settings.customizePage.js';
import { BehaviorPage } from './settings.behaviorPage.js';
import { AboutPage } from './settings.aboutPage.js';

export default class RocketBarExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // enable search
        window.set_search_enabled(true);

        // resize the window
        window.set_size_request(
            window.default_width + 50,
            window.default_height + 150
        );

        // create pages
        window.add(new GeneralPage(settings));
        window.add(new CustomizePage(settings));
        window.add(new BehaviorPage(settings));
        window.add(new AboutPage());
    }
}
