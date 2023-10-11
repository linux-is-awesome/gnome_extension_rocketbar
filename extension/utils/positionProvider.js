/* exported PositionProvider */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class PositionProvider {

    constructor(actor) {
        this._actor = actor;
        this._position = 'left';
        this._offset = 0;
    }

    destroy() {
        this.togglePositionLock(false);
    }

    setPosition(position = 'left', offset = 0) {

        this._position = position;
        this._offset = offset;

        this._handlePosition();
    }

    togglePositionLock(locked = false, callback) {

        if (!this._actor) {
            return;
        }

        if (locked && !this._positionLockId) {

            this._positionLockId = this._actor.connect('notify::position', () => {

                if (this._handlePosition() && callback) {
                    callback();
                }

            });

            return;
        }

        if (!locked && this._positionLockId) {
            this._actor.disconnect(this._positionLockId);
            this._positionLockId = null;
        }
    }

    _handlePosition() {

        let targetParent = null;

        switch (this._position) {
            case 'left':
                targetParent = Main.panel._leftBox;
                break;
            case 'center':
                targetParent = Main.panel._centerBox;
                break;
            case 'right':
                targetParent = Main.panel._rightBox;
                break;
        }

        if (!targetParent) {
            return false;
        }

        const parent = this._actor?.mapped ? this._actor.get_parent() : null;

        if (parent && parent === targetParent) {

            if (this._offset > targetParent.get_n_children() ||
                    parent.get_child_at_index(this._offset) === this._actor) {
                return false;
            }

            targetParent.set_child_at_index(this._actor, this._offset);

            return true;
        }

        if (parent) {
            parent.remove_actor(this._actor);
        }

        targetParent.insert_child_at_index(this._actor, this._offset);

        return true;
    }

}
