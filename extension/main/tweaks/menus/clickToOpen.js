import { MainPanel } from '../../core/shell.js';
import Context from '../../core/context.js';

export default class {

    constructor() {
        const menuManager = MainPanel.menuManager;
        if (!menuManager) return;
        Context.hooks.add(this, menuManager, menuManager._changeMenu, () => true, true);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

}
