import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

declare global {
    var global: Shell.Global
}

declare module 'gi://GObject' {

    interface Object {

        connectObject(...args): void

        disconnectObject(target): void

    }

}

declare module 'gi://Clutter' {

    interface Actor {

        _delegate: any;

        set(props: object): void

        ease(props: object): void

    }

}

declare module 'gi://St' {

    interface Adjustment {

        ease(value: any, props: object): void
    }

    interface ThemeNode {

        adjust_preferred_height(min_height_p: number | null, natural_height_p: number): [number, number]

        adjust_preferred_width(min_width_p: number | null, natural_width_p: number): [number, number]
    }

}

declare module 'resource:///org/gnome/shell/misc/signals.js' {

    interface EventEmitter {

        emit(event: string, ...args): void

        connect(event: string, callback: function): number

        disconnect(event: string): void

    }

}

declare module 'resource:///org/gnome/shell/ui/dnd.js' {

    interface _Draggable {

        /**
         * Introduced in GNOME 49
         */
        _dndGesture?: St.DndStartGesture

        /**
         * @deprecated since GNOME 49
         */
        fakeRelease(): void

        connectObject(...args): void

        disconnectObject(target): void

        /**
         * @deprecated since GNOME 49
         */
        _onButtonPress(actor: Clutter.Actor, event: Clutter.Event): void

        /**
         * @deprecated since GNOME 49
         */
        _onTouchEvent(actor: Clutter.Actor, event: Clutter.Event): void

    }

    function makeDraggable(actor: Clutter.Actor, params?: Object): _Draggable

}

declare module 'resource:///org/gnome/shell/ui/appFavorites.js' {

    interface AppFavorites {

        _parentalControlsManager

        getFavoriteMap(): {[appId: string]: Shell.App}

        addFavoriteAtPos(appId: string, pos: number): void

        moveFavoriteToPos(appId: string, pos: number): void

        removeFavorite(appId: string): void

    }

}
