import Context from '../core/context.js';
import Page from './base/page.js';
import { PreferencesPage, MetadataField } from '../../shared/enums/general.js';

const LOGO_PATH = '/assets/images/';
const RELEASE_NOTES_URL_PATH = '/releases';
const SUPPORT_URL_PATH = '/issues/new?template=';
const HOME_PAGE_URL = 'https://extensions.gnome.org/extension/9249';

const DAY_START_HOURS = 7;
const DAY_END_HOURS = 19;

/** @enum {string} */
const Widget = {
    Logo: 'logo',
    ReleaseVersion: 'release-version',
    ReleaseNotes: 'release-notes',
    ReportBug: 'report-bug',
    SuggestFeature: 'suggest-feature',
    HomePage: 'home-page'
};

/** @enum {string} */
const SupportTemplate = {
    Bug: 'bug_report.md',
    Feature: 'feature_request.md'
};

/** @enum {string} */
const Logo = {
    Day: 'logo_day.jpg',
    Night: 'logo_night.jpg'
};

export default class extends Page {

    constructor() {
        super(PreferencesPage.About, () => this.#initialize());
    }

    #initialize() {
        const metadata = Context.metadata ?? {};
        const githubUrl = metadata[MetadataField.Url] ?? '';
        const releaseVersion = this.getLabel(Widget.ReleaseVersion);
        const releaseNotes = this.getLinkButton(Widget.ReleaseNotes);
        const reportBug = this.getLinkButton(Widget.ReportBug);
        const suggestFeature = this.getLinkButton(Widget.SuggestFeature);
        const homePage = this.getLinkButton(Widget.HomePage);
        releaseVersion.set_label(metadata[MetadataField.VersionName] ?? '');
        releaseNotes.set_uri(`${githubUrl}${RELEASE_NOTES_URL_PATH}`);
        reportBug.set_uri(`${githubUrl}${SUPPORT_URL_PATH}${SupportTemplate.Bug}`);
        suggestFeature.set_uri(`${githubUrl}${SUPPORT_URL_PATH}${SupportTemplate.Feature}`);
        homePage.set_uri(HOME_PAGE_URL);
        this.#updateLogo();
    }

    #updateLogo() {
        const currentHours = new Date().getHours();
        const logoFile = currentHours >= DAY_START_HOURS &&
                         currentHours < DAY_END_HOURS ? Logo.Day : Logo.Night;
        const logo = this.getPicture(Widget.Logo);
        logo.set_filename(`${Context.path}${LOGO_PATH}${logoFile}`);
    }

}
