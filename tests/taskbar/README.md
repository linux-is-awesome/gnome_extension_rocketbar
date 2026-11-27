# Taskbar service fixture

GTK4 fixture app and step scripts for exercising Rocketbar’s taskbar service
(install/uninstall, launch/quit, pin/unpin, multi-window, multi-instance,
desktop-removal races).

## Layout

| Path | Role |
|------|------|
| `app/` | GTK4 fixture (`org.rocketbar.TaskbarFixture`) + `.desktop` template |
| `lib/common` | Shared paths / D-Bus / favorites / multi-instance helpers |
| `lib/scenario` | Scenario bootstrap (optional count, cleanup, count asserts) |
| `steps/` | Atomic actions (no file extension) |
| `scenarios/` | Ordered compositions |
| `menu` | Section titles for `./tests/start` (scenario groups; actions stay in `actions/`) |

## Dependencies

- Python 3 + PyGObject (GTK 4, Gio for favorites)
- `gdbus`, `gtk-launch` (optional fallback launches the binary directly)
- `gsettings` (`org.gnome.shell favorite-apps`)

## Instance count

Default is **1** (same as before). Pass a positive integer to steps/scenarios for more:

```bash
./tests/taskbar/scenarios/smoke           # 1 app
./tests/taskbar/scenarios/smoke 8         # 8 apps (scroll / perf)
./tests/taskbar/steps/install 8
./tests/taskbar/steps/launch 8
```

Ids: `org.rocketbar.TaskbarFixture`, then `.i2`, `.i3`, …  

Window tokens from `open-window`: bare `id` when count is 1; `index:id` when count > 1.

## Quick start

Colored menu — pick a **block** (e.g. taskbar), then a scenario/action.
Instance count is asked before each run (default/last saved value remembered):

```bash
./tests/start
./tests/start taskbar smoke 5
./tests/start taskbar launcher-progress-normal
./tests/start taskbar launcher-progress-infinite
./tests/start taskbar open-apps 8   # launch N apps; wait until closed, then cleanup
./tests/start taskbar all -n 3
```

Or call scenarios directly:

```bash
./tests/taskbar/scenarios/smoke
./tests/taskbar/scenarios/smoke 5
```

Odd / race cases (visual: lingering / duplicate taskbar icons):

```bash
./tests/taskbar/scenarios/zombie-uninstall
./tests/taskbar/scenarios/zombie-uninstall 3
./tests/taskbar/scenarios/remove-desktop-kill
./tests/taskbar/scenarios/remove-desktop-running
./tests/taskbar/scenarios/desktop-restore-running
./tests/taskbar/scenarios/desktop-restore-kill-race
./tests/taskbar/scenarios/rapid-unpin-kill
./tests/taskbar/scenarios/rapid-kill-unpin
./tests/taskbar/scenarios/rapid-favorite-flip
./tests/taskbar/scenarios/launch-then-pin
./tests/taskbar/scenarios/unpin-close
./tests/taskbar/scenarios/kill-pinned
./tests/taskbar/scenarios/unpinned-close
```

Launcher API progress (visual — taskbar icon bar):

```bash
./tests/taskbar/scenarios/launcher-progress-normal
./tests/taskbar/scenarios/launcher-progress-infinite
```

Enable **Misc → Launcher API** and **Taskbar → Progress bars** in Rocketbar prefs first.

Scenarios that touch favorites restore `org.gnome.shell favorite-apps` on exit.

## Steps

| Step | Role |
|------|------|
| `install` / `uninstall` | Binary + N `.desktop` files (`--app-id`) |
| `launch` / `quit` / `kill` | gtk-launch / D-Bus Quit / `SIGKILL` (kill runs all instances in parallel) |
| `pin` / `unpin` | Favorites for each instance |
| `remove-desktop` / `restore-desktop` | Delete or rewrite `.desktop` only (processes kept) |
| `open-window` / `close-window` / `close-all` / `window-count` | D-Bus window control |
| `set-launcher-progress` / `clear-launcher-progress` | Unity `LauncherEntry.Update` (fractional progress) |
| `launcher-progress-demo` / `set-launcher-progress-infinite` | Animated 0→1 demo or infinite (`-1`) progress |
| `settle` | Sleep (`settle [count] [seconds]` or `settle [seconds]`) |

## D-Bus control

- Name: application id (`org.rocketbar.TaskbarFixture` or `….iN`)
- Path: `/org/rocketbar/TaskbarFixture/Control`
- Interface: `org.rocketbar.TaskbarFixture`
- Methods: `OpenWindow`, `CloseWindow(u)`, `CloseAll`, `Quit`, `GetWindowCount`, `ListWindows`,
  `SetLauncherProgress(db)`, `ClearLauncherProgress`, `RunLauncherProgressDemo(u)`,
  `SetLauncherInfiniteProgress(b)`
- Progress signals use `application://<app-id>.desktop` on
  `com.canonical.Unity.LauncherEntry` (`/com/canonical/unity/launcherentry/1`).
