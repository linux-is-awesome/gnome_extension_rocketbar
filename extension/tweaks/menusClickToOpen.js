import { MainPanel } from '../main/shell.js';

export default class {

    constructor() {
        const menuManager = MainPanel.menuManager;
        if (typeof menuManager?._changeMenu !== 'function') return;
        menuManager._changeMenu = () => {};
    }

    destroy() {
        const menuManager = MainPanel.menuManager;
        if (typeof menuManager?._changeMenu !== 'function') return;
        menuManager._changeMenu = menuManager.constructor.prototype._changeMenu;
    }

}
