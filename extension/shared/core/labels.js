import Context from './context.js';

const _ = Context.gettext;

/** @enum {string} */
export const Label = {
    Pin: _('Pin'),
    SoundVolumeControl: _('Sound Volume Control'),
    Customize: _('Customize'),
    ActivateBehavior: _('Activation Behavior'),
    DemandsAttentionBehavior: _('Demands Attention Behavior'),
    CustomIcon: _('Custom Icon'),
    IconSize: _('Icon Size'),
    IconFromClipboard: _('Icon from Clipboard'),
    NoIconInClipboard: _('No Icon Found in Clipboard'),
    ResetToDefault: _('Reset to Default'),
    ResetAllToDefault: _('Reset All to Default'),
    NewWindow: _('New Window'),
    FindWindow: _('Find Window'),
    MoveWindows: _('Move Windows'),
    FocusActive: _('Set Focus When Active'),
    FocusAll: _('Always Set Focus'),
    SelectIcon: _('Select Icon'),
    Icon: _('Icon'),
    AppDefault: _('Application Default'),
    CurrentWorkspace: _('Current Workspace'),
    OtherWorkspaces: _('Other Workspaces'),
    CloseAll: _('Close All'),
    CurrentMonitor: _('This Monitor'),
    MonitorLeft: _('Monitor Left'),
    MonitorRight: _('Monitor Right'),
    MonitorAbove: _('Monitor Above'),
    MonitorBelow: _('Monitor Below'),
    MoveTo: _('Move to'),
    PreferredMonitor: _('Preferred Monitor'),
    PrimaryMonitor: _('Primary'),
    LeftOfPrimaryMonitor: _('Left of Primary'),
    RightOfPrimaryMonitor: _('Right of Primary'),
    AbovePrimaryMonitor: _('Above Primary'),
    BelowPrimaryMonitor: _('Below Primary'),
    PleaseWait: _('Please Wait...')
};
