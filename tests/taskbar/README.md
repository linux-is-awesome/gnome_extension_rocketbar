# Taskbar service fixture

Host-native GTK4 app and step scripts for exercising Rocketbar’s taskbar service
(install/uninstall, launch/quit, pin/unpin, multi-window, multi-instance,
desktop-removal races). Run on the host desktop session.

## Layout

| Path | Role |
|------|------|
| `app/` | GTK4 fixture (`org.rocketbar.TaskbarFixture`) + `.desktop` template |
| `lib/common` | Shared paths / D-Bus / favorites / multi-instance helpers |
| `lib/scenario` | Scenario bootstrap (optional count, cleanup, count asserts) |
| `steps/` | Atomic actions (no file extension) |
| `scenarios/` | Ordered compositions |

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
Generated `.desktop` files use `NoDisplay=true` (hidden from the app grid, still launchable).

Window tokens from `open-window`: bare `id` when count is 1; `index:id` when count > 1.

## Quick start

Colored menu — pick a **block** (e.g. taskbar), then a scenario/action.
Instance count is asked before each run (default/last saved value remembered):

```bash
./tests/start
./tests/start taskbar smoke 5
./tests/start taskbar open-apps 8   # launch N apps; wait until closed, then cleanup
./tests/start taskbar all -n 3
```

Or call scenarios directly:

```bash
./tests/taskbar/scenarios/smoke
./tests/taskbar/scenarios/smoke 5
```

Odd / race cases:

```bash
./tests/taskbar/scenarios/zombie-uninstall
./tests/taskbar/scenarios/zombie-uninstall 3
./tests/taskbar/scenarios/remove-desktop-running
./tests/taskbar/scenarios/rapid-unpin-kill
./tests/taskbar/scenarios/unpin-close
./tests/taskbar/scenarios/kill-pinned
./tests/taskbar/scenarios/unpinned-close
```

Scenarios that touch favorites restore `org.gnome.shell favorite-apps` on exit.

## Steps

| Step | Role |
|------|------|
| `install` / `uninstall` | Binary + N hidden `.desktop` files (`--app-id`) |
| `launch` / `quit` / `kill` | gtk-launch / D-Bus Quit / `SIGKILL` for each instance |
| `pin` / `unpin` | Favorites for each instance |
| `remove-desktop` | Delete `.desktop` only (processes kept) |
| `open-window` / `close-window` / `close-all` / `window-count` | D-Bus window control |
| `settle` | Sleep (`settle [count] [seconds]` or `settle [seconds]`) |

## D-Bus control

- Name: application id (`org.rocketbar.TaskbarFixture` or `….iN`)
- Path: `/org/rocketbar/TaskbarFixture/Control`
- Interface: `org.rocketbar.TaskbarFixture`
- Methods: `OpenWindow`, `CloseWindow(u)`, `CloseAll`, `Quit`, `GetWindowCount`, `ListWindows`
