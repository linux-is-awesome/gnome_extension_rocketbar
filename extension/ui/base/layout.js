/* exported Layout */

import St from 'gi://St';
import { Component } from './component.js';

export class Layout extends Component {
    constructor(name = null) {
        super(new St.BoxLayout({ name }));
    }
}
