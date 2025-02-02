/**
 * @typedef {import('../appButton.js').AppButton} AppButton
 * @typedef {import('../appIcon.js').AppIcon} AppIcon
 */

import { AppIcon as AppDisplayIcon } from 'resource:///org/gnome/shell/ui/appDisplay.js';
import { DragMotionResult } from 'resource:///org/gnome/shell/ui/dnd.js';
import { Overview } from '../../../core/shell.js';

export class DragActor {

    /** @type {AppButton?} */
    #appButton = null;

    /**
     * @param {AppButton} appButton
     * @param {AppIcon} appIcon
     */
    constructor(appButton, appIcon) {
        this.#appButton = appButton;
        const appDisplayIcon = new AppDisplayIcon(appButton.app);
        appDisplayIcon.getDragActorSource = () => appIcon.actor;
        appDisplayIcon.getDragActor = () => appIcon.dragActor;
        appDisplayIcon.activate = () => appButton.activate();
        appDisplayIcon.animateLaunchAtPos = (x, y) => appButton.animateLaunchAtPos(x, y);
        appDisplayIcon._delegate = appButton;
        appButton.actor._delegate = appDisplayIcon;
        this.#patchAppDisplay();
        Overview.beginItemDrag(appDisplayIcon);

    }

    /**
     * @param {boolean} [isDragCancelled]
     */
    destroy(isDragCancelled = false) {
        if (!this.#appButton) return;
        const appButtonActor = this.#appButton.actor;
        if (appButtonActor._delegate instanceof AppDisplayIcon) {
            const appDisplayIcon = appButtonActor._delegate;
            if (isDragCancelled) Overview.cancelledItemDrag(appDisplayIcon);
            Overview.endItemDrag(appDisplayIcon);
            if (!isDragCancelled) Overview.cancelledItemDrag(appDisplayIcon);
            appDisplayIcon._delegate = null;
            appDisplayIcon.destroy();
        }
        appButtonActor._delegate = this.#appButton;
        this.#appButton = null;
        this.#revertAppDisplayChanges();
    }

    #patchAppDisplay() {
        const appDisplay = Overview._overview?._controls?._appDisplay;
        if (!appDisplay) return;
        const appDisplayDragOverHandler = appDisplay.constructor.prototype.handleDragOver;
        if (typeof appDisplayDragOverHandler !== 'function') return;
        appDisplay.handleDragOver = source => {
            const result = appDisplayDragOverHandler.call(appDisplay, source);
            const isDropAccepted = source === this.#appButton?.actor?._delegate &&
                                   result === DragMotionResult.MOVE_DROP;
            return isDropAccepted ? DragMotionResult.COPY_DROP : result;
        };
    }

    #revertAppDisplayChanges() {
        const appDisplay = Overview._overview?._controls?._appDisplay;
        if (!appDisplay) return;
        appDisplay.handleDragOver = appDisplay.constructor.prototype.handleDragOver;
    }

}
