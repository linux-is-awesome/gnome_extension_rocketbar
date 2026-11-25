import Context from '../core/context.js';
import Page from './base/page.js';
import { PreferencesPage, MetadataField } from '../../shared/enums/general.js';

const LOGO_PATH = '/assets/images/';
const RELEASE_NOTES_URL_PATH = '/releases';
const SUPPORT_URL_PATH = '/issues/new?template=';
const HOME_PAGE_URL = 'https://extensions.gnome.org/extension/5180';

const DAY_START_HOURS = 7;
const DAY_END_HOURS = 19;
const CHRISTMAS_START_MONTH = 11;
const CHRISTMAS_START_DAY = 15;
const CHRISTMAS_END_MONTH = 0;
const CHRISTMAS_END_DAY = 7;

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
    Night: 'logo_night.jpg',
    DayChristmas: 'logo_day_christmas.jpg',
    NightChristmas: 'logo_night_christmas.jpg'
};

export default class extends Page {

    constructor() {
        super(PreferencesPage.About, () => this.#initialize());
    }

    /** @returns {boolean} */
    get #isChristmas() {
        const month = new Date().getMonth();
        const day = new Date().getDate();
        return month === CHRISTMAS_START_MONTH && day >= CHRISTMAS_START_DAY ||
               month === CHRISTMAS_END_MONTH && day <= CHRISTMAS_END_DAY;
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
        const isDaytime = currentHours >= DAY_START_HOURS && currentHours < DAY_END_HOURS;
        const logoFile = this.#isChristmas ?
                         isDaytime ? Logo.DayChristmas : Logo.NightChristmas :
                         isDaytime ? Logo.Day : Logo.Night;
        const logo = this.getPicture(Widget.Logo);
        logo.set_filename(`${Context.path}${LOGO_PATH}${logoFile}`);
    }

}
