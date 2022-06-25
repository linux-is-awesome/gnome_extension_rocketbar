var Connections = class Connections {

    constructor() {
        this._connections = new Map();
    }

    destroy() {
        this._connections.forEach(connection => {
            connection.target.disconnect(connection.id);
        });
        this._connections = null;
    }

    add(target, event, callback) {

        if (!target || !event || !callback) {
            return;
        }

        this._connections.set(event, {
            target: target,
            id: target.connect(event, callback)
        });
    }

    remove(event) {

        if (!event || !this._connections.has(event)) {
            return;
        }

        const connection = this._connections.get(event);

        connection.target.disconnect(connection.id);

        this._connections.delete(event);
    }
}