/**
 * @typedef {object} Labels
 * @property {string} Pin
 * @property {string} SoundVolumeControl
 * @property {string} Customize
 * @property {string} ActivateBehavior
 * @property {string} DemandsAttentionBehavior
 * @property {string} CustomIcon
 * @property {string} IconSize
 * @property {string} IconFromClipboard
 * @property {string} NoIconInClipboard
 * @property {string} ResetToDefault
 * @property {string} ResetAllToDefault
 * @property {string} NewWindow
 * @property {string} FindWindow
 * @property {string} MoveWindows
 * @property {string} FocusActive
 * @property {string} FocusAll
 * @property {string} SelectIcon
 * @property {string} Icon
 * @property {string} AppDefault
 * @property {string} CurrentWorkspace
 * @property {string} OtherWorkspaces
 * @property {string} CloseAll
 * @property {string} CurrentMonitor
 * @property {string} MonitorLeft
 * @property {string} MonitorRight
 * @property {string} MonitorAbove
 * @property {string} MonitorBelow
 * @property {string} MoveTo
 * @property {string} PreferredMonitor
 * @property {string} PrimaryMonitor
 * @property {string} LeftOfPrimaryMonitor
 * @property {string} RightOfPrimaryMonitor
 * @property {string} AbovePrimaryMonitor
 * @property {string} BelowPrimaryMonitor
 * @property {string} PleaseWait
 *
 * @param {(label: string) => string} _
 * @returns {Labels}
 */
export default _ => ({
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
});
