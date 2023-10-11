/* exported Connections */

export class Connections {

    constructor() {
        this._connections = new Map();
    }

    destroy() {
        this._connections.forEach(connection => {
            connection.target.disconnect(connection.id);
        });
        this._connections = null;
    }

    addScope(target, scope, callback) {

        if (!target || !scope || !callback) {
            return;
        }

        for (let event of scope) {
            this.add(target, event, callback);
        }
    }

    removeScope(scope) {

        if (!scope) {
            return;
        }

        for (let event of scope) {
            this.remove(event);
        }
    }

    add(target, event, callback) {

        if (!target || !event || !callback ||
                this._connections.has(event)) {
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
