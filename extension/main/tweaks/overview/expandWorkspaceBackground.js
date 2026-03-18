/**
 * @typedef {import('resource:///org/gnome/shell/ui/workspace.js').Workspace} Workspace
 * @typedef {import('resource:///org/gnome/shell/ui/workspace.js').WorkspaceBackground} WorkspaceBackground
 * @typedef {import('resource:///org/gnome/shell/ui/overviewControls.js').OverviewAdjustment} OverviewAdjustment
 * @typedef {import('resource:///org/gnome/shell/ui/workspacesView.js').WorkspacesDisplay} WorkspacesDisplay
 */

import Graphene from 'gi://Graphene';
import { ControlsState } from 'resource:///org/gnome/shell/ui/overviewControls.js';
import Context from '../../core/context.js';
import { Overview } from '../../core/shell.js';
import { Event, Progress } from '../../../shared/enums/general.js';

export default class {

    /** @type {OverviewAdjustment?} */
    #overviewAdjustment = null;

    /** @type {WorkspacesDisplay?} */
    #workspacesDisplay = null;

    /** @type {WorkspaceBackground?} */
    #workspaceBackground = null;

    constructor() {
        const overviewControls = Overview._overview?.controls;
        if (!overviewControls) return;
        this.#overviewAdjustment = overviewControls._stateAdjustment ?? null;
        this.#workspacesDisplay = overviewControls._workspacesDisplay ?? null;
        if (!this.#overviewAdjustment || !this.#workspacesDisplay) return;
        Context.signals.add(this, [this.#overviewAdjustment,
            Event.ValueChanged, () => this.#handleOverviewAdjustment()]);
    }

    destroy() {
        Context.signals.removeAll(this);
        this.#overviewAdjustment = null;
        this.#workspacesDisplay = null;
        this.#workspaceBackground = null;
    }

    #handleOverviewAdjustment() {
        if (!this.#overviewAdjustment || !this.#workspacesDisplay) return;
        const { initialState, finalState, progress } = this.#overviewAdjustment.getStateTransitionParams();
        if ((finalState !== ControlsState.HIDDEN && finalState !== ControlsState.WINDOW_PICKER) ||
            (initialState > ControlsState.WINDOW_PICKER && finalState > ControlsState.HIDDEN)) {
            this.#workspaceBackground = null;
            return;
        }
        const isGrowing = initialState > finalState;
        const actualProgress = +(isGrowing ? progress : Progress.Max - progress).toFixed(2);
        if (progress < Progress.Max && !this.#workspaceBackground) {
            const activeWorkspace = this.#workspacesDisplay._getPrimaryView()?.getActiveWorkspace();
            this.#workspaceBackground = activeWorkspace?._background ?? null;
        } else if (progress >= Progress.Max) {
            this.#adjustWorkspaceBackgroundSize(actualProgress);
            this.#workspaceBackground = null;
            return;
        }
        if (!this.#workspaceBackground) return;
        this.#adjustWorkspaceBackgroundSize(actualProgress);
    }

    /**
     * @param {number} progress
     */
    #adjustWorkspaceBackgroundSize(progress) {
        if (!this.#workspaceBackground) return;
        const { _monitorIndex, _bin, _bgManager, _workarea } = this.#workspaceBackground;
        const monitor = Context.monitors.list[_monitorIndex];
        if (!monitor) return;
        const backgroundActor = _bgManager?.backgroundActor;
        if (!_workarea || !_bin || !backgroundActor) {
            this.#workspaceBackground = null;
            return;
        }
        const { x, y, width, height } = _workarea;
        const offsetTop = Math.max(y - monitor.y, 0);
        const offsetBottom = offsetTop ? 0 : Math.max(monitor.height - height, 0);
        if (!offsetTop && !offsetBottom) return;
        const isLastFrame = +progress.toFixed(1) <= 0;
        if (isLastFrame) {
            if (!_bin.has_clip) return;
            progress = 0;
        }
        const progressTop = offsetTop ? y * progress : 0;
        const progressBottom = offsetTop ? 0 : offsetBottom * progress;
        const clipHeight = offsetTop ? height + progressTop :
                                       _bin.get_allocation_box().get_height() + progressBottom;
        const roundedClipBounds = new Graphene.Rect();
        roundedClipBounds.origin.x = x - monitor.x;
        roundedClipBounds.origin.y = offsetTop - progressTop;
        roundedClipBounds.size.width = width;
        roundedClipBounds.size.height = offsetTop ? clipHeight : height + progressBottom;
        backgroundActor.content.set_rounded_clip_bounds(roundedClipBounds);
        if (isLastFrame) _bin.remove_clip();
        else _bin.set_clip(0, -progressTop, width, clipHeight);
    }

}
