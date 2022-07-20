# Rocketbar
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/linux-is-awesome/gnome_extension_rocketbar/blob/master/LICENSE)

![](/media/taskbar.jpg)

-----

### Key Features

- Taskbar
    - Optimized for best performance
    - Doesn't hurt CPU and Shell on every mouse click
    - Highly customizable
    - Dominant color support for app buttons and indicators
    - Optimized to work with a fully transparent panel
    - Supports both top and bottom positions of the Main panel
    - Per app customization feature
    - Drag and Drop support to reorder existing and pin new apps in the taskbar
    - Displaying of notification badges on top of app buttons
    - Tooltips with additional information such as windows count and notification count
    - Set focus on urgent windows of an active application automatically (Fixes 'Open Folder' dialog in VS Code and so on)

- Shell Tweaks
    - Dash killing feature to hide the Dash and prevent it from rendering behind the scene
    - Scroll the Main panel to change sound volume and middle click to toggle mute
    - Activities button click behavior override
    - Overview empty space clicks support
    - Fullscreen Hot Corner
    
Note: to get additional customization options for the GNOME Shell I would suggest to use [Just Perfection](https://extensions.gnome.org/extension/3843/just-perfection) extension.

### Compatibility

- Gnome 42+
- Developed and tested using Manjaro Gnome

-----

### Demonstration

- Taskbar on top

![](/media/taskbar_top.png)

- Taskbar on bottom

![](/media/taskbar_bottom.png)

### Per app customization options

- Right click on an app button to open a context menu
- Find Customize section
- Change options or reset current customizations
    - Activitation Behavior
        - New Window - if an app is displaying as not running for the current workspace, create a new window of the app on the workspace
        - Move Windows - if app is running on another workspace, move windows of the app to the current one. Can be useful for apps that don't support creating of new windows, such as GitHub Desktop and etc.
    - Icon Size
        - Allows to change the icon size a bit when app icon looks smaller/bigger than others
            
![](/media/customize.png)

-----

### Get the latest official release

<p align="left">
    <a href="https://extensions.gnome.org/extension/5180/rocketbar" >
        <img src="/media/get-it-logo.png" width="240"/>
    </a>
</p>

### Manual installation steps to get the latest and greatest version

- open Terminal and run the following commands:
```
git clone https://github.com/linux-is-awesome/gnome_extension_rocketbar
cd ./gnome_extension_rocketbar
OPTIONAL: to get the latest UNSTABLE version type: git checkout develop
./install
```

- push Alt + F2 and type 'r'
- go to Extensions and enable Rocketbar there

-----

### Translations

No translations as of now, but you can help!

To do so:

- open Terminal and run the following commands:
```
git clone https://github.com/linux-is-awesome/gnome_extension_rocketbar
cd ./gnome_extension_rocketbar
git branch translation_<locale> (translation_en, translation_es, translation_ru and so on...)
git checkout <name of the translation branch>
./create-translation <locale>
```
- A new <locale>.po file will be created under the extension/locales folder
- Go to the file, translate text strings
- Commit your changes and publish the branch
- Create a pull request to the 'develop' branch

-----

### Credits

[App Icons Taskbar](https://gitlab.com/AndrewZaech/aztaskbar) |
[Dash to Dock](https://github.com/micheleg/dash-to-dock) |
[Overview Clicking](https://github.com/mechtifs/overview-clicking) |
[Volume Scroller](https://github.com/trflynn89/gnome-shell-volume-scroller) |
[Fullscreen Hot Corner](https://github.com/soal/gnome-shell-fullscreen-hot-corner) |
[Just Perfection](https://gitlab.gnome.org/jrahmatzadeh/just-perfection)
