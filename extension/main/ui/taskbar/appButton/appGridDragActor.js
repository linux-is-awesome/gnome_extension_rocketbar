/**
 * @typedef {import('../appButton.js').AppButton} AppButton
 * @typedef {import('../appIcon.js').AppIcon} AppIcon
 */

import Context from '../../../core/context.js';
import { AppIcon as AppGridIcon } from 'resource:///org/gnome/shell/ui/appDisplay.js';
import { DragMotionResult } from 'resource:///org/gnome/shell/ui/dnd.js';
import { Overview } from '../../../core/shell.js';

export default class AppGridDragActor {

    /** @type {AppButton?} */
    #appButton = null;

    /**
     * Note: `getDragActor` must return the `appIcon.dragActor` to ensure the correct icon.
     *       `getDragActorSource` must return the `appIcon.actor` to ensure the correct drag cancel animation.
     *
     * @param {AppButton} appButton
     * @param {AppIcon} appIcon
     */
    constructor(appButton, appIcon) {
        this.#appButton = appButton;
        /** @type {*} */
        const app = appButton.app;
        const appGridIcon = new AppGridIcon(app);
        appGridIcon.getDragActor = () => appIcon.dragActor;
        /** @type {() => *} */
        appGridIcon.getDragActorSource = () => appIcon.actor;
        appGridIcon.animateLaunchAtPos = (x, y) => appButton.animateLaunchAtPos(x, y);
        appGridIcon._delegate = appButton;
        appButton.actor._delegate = appGridIcon;
        this.#patchAppGrid();
        Overview.beginItemDrag(appGridIcon);

    }

    /**
     * @param {boolean} [isDragCancelled]
     */
    destroy(isDragCancelled = false) {
        if (!this.#appButton) return;
        const appButtonActor = this.#appButton.actor;
        if (appButtonActor._delegate instanceof AppGridIcon) {
            const appGridIcon = appButtonActor._delegate;
            if (isDragCancelled) Overview.cancelledItemDrag(appGridIcon);
            Overview.endItemDrag(appGridIcon);
            if (!isDragCancelled) Overview.cancelledItemDrag(appGridIcon);
            appGridIcon._delegate = null;
            appGridIcon.destroy();
        }
        appButtonActor._delegate = this.#appButton;
        this.#appButton = null;
        Context.hooks.removeAll(this);
    }

    #patchAppGrid() {
        const appGrid = Overview._overview?._controls?._appDisplay;
        if (!appGrid) return;
        Context.hooks.add(this, appGrid, appGrid.handleDragOver, (_, result, source) =>
            source === this.#appButton?.actor?._delegate &&
            result === DragMotionResult.MOVE_DROP ? DragMotionResult.COPY_DROP : result);
    }

}
