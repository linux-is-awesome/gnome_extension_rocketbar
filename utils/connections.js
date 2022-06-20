var Connections = class Connections {

    constructor() {
        this._connections = new Map();
    }

    destroy() {
        this._connections.forEach((target, id) => {
            target.disconnect(id);
            id = null;
        });
        this._connections = null;
    }

    add(target, event, callback) {

        if (!target || !event || !callback) {
            return;
        }

        this._connections.set(target.connect(event, callback), target);
    }
}