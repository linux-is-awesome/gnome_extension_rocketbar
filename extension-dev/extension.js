import Extension from './extensionBase.js';
import { RuntimeLocation } from './devUtils.js';

export default class extends Extension {

    /** @type {string} */
    get runtimePath() {
        return `${RuntimeLocation(this.path)}${super.runtimePath}`;
    }

}
