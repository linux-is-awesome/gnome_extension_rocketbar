import Context from '../core/context.js';

const _ = Context.gettext;

/** @enum {string} */
export const Label = {
    Pin: _('Pin'),
    SoundVolumeControl: _('Sound Volume Control'),
    Customize: _('Customize'),
    FindWindow: _('Find Window'),
    MoveWindows: _('Move Windows'),
    CurrentWorkspace: _('Current Workspace'),
    OtherWorkspaces: _('Other Workspaces'),
    MinimizeAll: _('Minimize All'),
    RaiseAll: _('Raise All'),
    CloseAll: _('Close All'),
    CurrentMonitor: _('This Monitor'),
    MonitorLeft: _('Monitor Left'),
    MonitorRight: _('Monitor Right'),
    MonitorAbove: _('Monitor Above'),
    MonitorBelow: _('Monitor Below'),
    MoveTo: _('Move to')
};
