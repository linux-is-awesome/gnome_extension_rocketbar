/**
 * @typedef {import('resource:///org/gnome/shell/ui/popupMenu.js').PopupMenu} PopupMenu
 */

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Mtk from 'gi://Mtk';
import { MainPanel } from '../../core/shell.js';
import Context from '../../core/context.js';
import { Alignment } from '../../../shared/enums/general.js';

/** @type {{[alignment: string]: number}} */
const MenuSide = {
    [Alignment.Top]: St.Side.TOP,
    [Alignment.Bottom]: St.Side.BOTTOM,
    [Alignment.Left]: St.Side.LEFT,
    [Alignment.Right]: St.Side.RIGHT
};

export default class {

    constructor() {
        const menuManager = MainPanel.menuManager;
        if (!menuManager) return;
        const { hooks } = Context;
        const patchMenu = menu => hooks.add(this, menu, menu.open, () => this.#handleOpeningMenu(menu), true);
        hooks.add(this, menuManager, menuManager.addMenu, (_, __, menu) => patchMenu(menu))
             .add(this, menuManager, menuManager.removeMenu, (_, __, menu) => hooks.remove(this, menu));
        const menus = menuManager._menus;
        if (!menus?.length) return;
        for (const menu of menus) patchMenu(menu);
    }

    destroy() {
        Context.hooks.removeAll(this);
    }

    /**
     * @param {PopupMenu} menu
     */
    #handleOpeningMenu(menu) {
        if (!menu) return;
        const { _boxPointer, sourceActor } = menu;
        if (!_boxPointer ||
            sourceActor instanceof Clutter.Actor === false ||
            !sourceActor.get_stage() || !sourceActor?.get_parent()) return;
        const rect = new Mtk.Rectangle();
        [rect.x, rect.y] = sourceActor.get_transformed_position();
        [rect.width, rect.height] = sourceActor.get_transformed_size();
        const [_, y] = Context.monitors.getAlignment(rect);
        const side = MenuSide[y];
        if (typeof side !== 'number') return;
        _boxPointer._arrowSide = side;
    }

}
