/**
 * @typedef {import('gi://Shell').App} Shell.App
 *
 * @typedef {import('resource:///org/gnome/shell/ui/sessionMode').SessionMode} SessionMode
 * @typedef {import('resource:///org/gnome/shell/ui/layout.js').LayoutManager} LayoutManager
 * @typedef {import('resource:///org/gnome/shell/ui/panel.js').Panel} Panel
 * @typedef {import('resource:///org/gnome/shell/ui/overview.js').Overview} Overview
 * @typedef {import('resource:///org/gnome/shell/ui/messageTray').MessageTray} MessageTray
 * @typedef {import('resource:///org/gnome/shell/ui/osdWindow').OsdWindowManager} OsdWindowManager
 *
 * @typedef {SessionMode} Session
 * @typedef {LayoutManager} MainLayout
 * @typedef {Panel} MainPanel
 * @typedef {{_app: Shell.App}} WindowAttentionSource
 * @typedef {import('resource:///org/gnome/shell/ui/notificationDaemon.js').FdoNotificationDaemonSource} FdoNotificationDaemonSource
 * @typedef {import('resource:///org/gnome/shell/ui/notificationDaemon.js').GtkNotificationDaemonAppSource} GtkNotificationDaemonAppSource
 * @typedef {import('resource:///org/gnome/shell/ui/messageTray.js').Source &
 *           FdoNotificationDaemonSource & GtkNotificationDaemonAppSource & WindowAttentionSource} MessageTray.Source
 */

import { sessionMode,
         layoutManager,
         panel,
         overview,
         messageTray,
         osdWindowManager } from 'resource:///org/gnome/shell/ui/main.js';

if (!sessionMode) throw new Error('SessionMode instance is not available.');
if (!layoutManager) throw new Error('LayoutManager instance is not available.');
if (!panel) throw new Error('Panel instance is not available.');
if (!overview) throw new Error('Overview instance is not available.');
if (!messageTray) throw new Error('MessageTray instance is not available.');
if (!osdWindowManager) throw new Error('OsdWindowManager instance is not available.');

/** @type {SessionMode} */
export const Session = sessionMode;

/** @type {LayoutManager} */
export const MainLayout = layoutManager;

/** @type {Panel} */
export const MainPanel = panel;

/** @type {Overview} */
export const Overview = overview;

/** @type {MessageTray} */
export const MessageTray = messageTray;

/** @type {OsdWindowManager} */
export const OsdWindowManager = osdWindowManager;
