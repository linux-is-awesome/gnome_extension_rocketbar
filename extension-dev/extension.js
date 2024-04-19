import Extension from './extensionBase.js';
import { RuntimeLocation } from './devUtils.js';

const RUNTIME_SEARCH_PATH = '.runtime';

export default class extends Extension {

    /**
     * @override
     * @type {string}
     */
    get runtimePath() {
        return `/${RUNTIME_SEARCH_PATH}${RuntimeLocation(`${this.path}/${RUNTIME_SEARCH_PATH}`)}${super.runtimePath}`;
    }

}
