import Context from '../core/context.js';
import Page from './base/page.js';
import { MetadataField } from '../../shared/core/enums.js';

const PAGE_NAME = 'about';
const LOGO_PATH = '/assets/images/logo.jpg';
const RELEASE_NOTES_URL_PATH = '/releases';
const SUPPORT_URL_PATH = '/issues/new?template=';
const HOME_PAGE_URL = 'https://extensions.gnome.org/extension/5180';

/** @enum {string} */
const PageObject = {
    Logo: 'logo',
    Version: 'version',
    VersionName: 'version-name',
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

export default class extends Page {

    constructor() {
        super(PAGE_NAME);
        this.#initialize();
    }

    #initialize() {
        const path = Context.path;
        const metadata = Context.metadata ?? {};
        const githubUrl = metadata[MetadataField.Url] ?? '';
        const logo = this.getPicture(PageObject.Logo);
        const version = this.getGroup(PageObject.Version);
        const versionName = this.getLabel(PageObject.VersionName);
        const releaseNotes = this.getLinkButton(PageObject.ReleaseNotes);
        const reportBug = this.getLinkButton(PageObject.ReportBug);
        const suggestFeature = this.getLinkButton(PageObject.SuggestFeature);
        const homePage = this.getLinkButton(PageObject.HomePage);
        logo.set_filename(`${path}${LOGO_PATH}`);
        version.set_title(metadata[MetadataField.Name] ?? '');
        versionName.set_label(metadata[MetadataField.VersionName] ?? '');
        releaseNotes.set_uri(`${githubUrl}${RELEASE_NOTES_URL_PATH}`);
        reportBug.set_uri(`${githubUrl}${SUPPORT_URL_PATH}${SupportTemplate.Bug}`);
        suggestFeature.set_uri(`${githubUrl}${SUPPORT_URL_PATH}${SupportTemplate.Feature}`);
        homePage.set_uri(HOME_PAGE_URL);
    }

}
