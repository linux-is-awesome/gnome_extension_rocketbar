/* exported ScrollHandler */

import Clutter from 'gi://Clutter';

export class ScrollHandler {

    constructor(actor, callback) {

        if (!actor) {
            return;
        }

        this._actor = actor;

        this._scrollHandler = this._actor.connect(
            'scroll-event',
            (actor, event) => this._handleScroll(event)
        );

        this._callback = callback;
    }

    destroy() {
        this._actor?.disconnect(this._scrollHandler);
    }

    _handleScroll(event) {

        if (!this._callback || !event) {
            return Clutter.EVENT_PROPAGATE;
        }

        const scrollDirection = event?.get_scroll_direction();

        // handle only 2 directions: UP and DOWN
        if (scrollDirection !== Clutter.ScrollDirection.UP &&
                scrollDirection !== Clutter.ScrollDirection.DOWN) {
            return Clutter.EVENT_PROPAGATE;
        }

        const isCtrlPressed = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;

        return this._callback([scrollDirection, isCtrlPressed]);
    }

}
