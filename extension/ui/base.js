const { GObject, St } = imports.gi;

var AppButtonBase = GObject.registerClass(
    class Rocketbar__AppButtonBase extends St.Button {

    }
);

var TaskbarBase = GObject.registerClass(
    class Rocketbar__TaskbarBase extends St.ScrollView {

    }
);