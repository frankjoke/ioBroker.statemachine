// StateMachines Classes v2.0.1 21.10.2017

/*jslint node: true */
"use strict";

const A = require('./myAdapter'),
    fields = {
        id: ' id',
        default: ' default',
        expanded: ' expanded',
        type: ' type',
        disabled: ' disabled',
        timeout: ' timeout',
        fire: ' fire',
        onFire: ' onfire',
        onEnter: ' onenter',
        onExit: ' onexit',
        function: ' function'
    };



class Setter { // fun = function returng a promise, min = minimal time in ms between next function call
    constructor(fun, min) {
        if (typeof fun !== 'function') throw Error('Invalid Argument - no function for Setter');
        this._efun = fun;
        this._list = [];
        this._current = null;
        this._min = min || 20;
        return this;
    }
    toString() {
        return `Setter(${this._min},${this.length})=${this.length>0 ? this._list[0] : 'empty'}`;
    }
    clearall() {
        this._list = [];
        return this;
    }
    add() {
        function execute(that) {
            if (that.length > 0 && !that._current) {
                that._current = that._list.shift();
                that._efun.apply(null, that._current)
                    .then(() => A.wait(that._min), e => e)
                    .then(() => execute(that, that._current = null), () => execute(that, that._current = null));
            }
        }

        const args = Array.prototype.slice.call(arguments);
        this._list.push(args);
        if (this._list.length === 1)
            execute(this);
        return this;
    }
}

class CacheP {
    constructor(fun) { // neue Einträge werden mit dieser Funktion kreiert
        // assert(!fun || A.T(fun) === 'function', 'Cache arg need to be a function returning a promise!');
        this._cache = {};
        this._fun = fun;
    }

    // get cache() {
    // return this._cache;
    // }
    // get fun() {
    // return this._fun;
    // }
    // set fun(newfun) {
    // assert(!newfun || A.T(newfun) === 'function', 'Cache arg need to be a function returning a promise!');
    // return (this._fun = newfun);
    // }

    cacheItem(item, fun) {
        let that = this;
        // assert(!fun || A.T(fun) === 'function', 'Cache arg need to be a function returning a promise!');
        //        A.D(`looking for ${item} in ${A.O(this._cache)}`);
        if (this._cache[item] !== undefined)
            return A.resolve(this._cache[item]);
        if (!fun)
            fun = this._fun;
        // assert(A.T(fun) === 'function', `checkItem needs a function to fill cache!`);
        return fun(item).then(res => (that._cache[item] = res), err => A.D(`checkitem error ${err} finding result for ${item}`, null));
    }
    // clear() {
    // this._cache = {};
    // }
    isCached(x) {
        return this._cache[x];
    }
}

const ids = {};


class BaseSM {
    constructor(id, type) {
        this._id = id;
        ids[id] = this;
        this._type = type;
        this._parent = null;
    }

    get id() {
        return this._id;
    }
    get type() {
        return this._type;
    }

    get disabled() {
        return this._disabled || (this.parent && this.parent.disabled);
    }
    set disabled(bool) {
        if (bool)
            this._disabled = bool;
        else
            delete this._disabled;

    }

    get parent() {
        return this._parent;
    }

    get expanded() {
        return this._expanded;
    }
    set expanded(bool) {
        if (bool)
            this._expanded = bool;
        else
            delete this._expanded;

    }
}

class BaseActions {
    constructor(parent) {
        this._parent = parent;
        this._list = [];
    }
    get list() {
        return this._list;
    }
    get disabled() {
        return this._parent.disabled;
    }
}

class SEvent {
    constructor(text) {
        this._text = text;
        this._type = 'unknown';
        this._parse(text);
    }

    _parse(name) {
        name = name.trim();
        var m; // evry xxx timer
        if ((m = name.match(/^(\d+w)?\s*(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*(\d+s?)?$/))) {
            var ts = 0;
            for (var i = 1; i < 6; ++i) {
                var s = m[i];
                if (s) {
                    if (s[s.length - 1] > '9')
                        s = s.slice(0, -1);
                    s = parseInt(s);
                    ts += s * [0, 7 * 24 * 60 * 60, 24 * 60 * 60, 60 * 60, 60, 1][i];
                }
            }
            ts = ts > 0 ? ts : 1;
            this._type = 'every';
            this._timer = ts;
            return this;
        } // time
        if ((m = name.match(/^([\d\-\*\,\/]+)\s*:\s*([\d\-\*\,\/]+)\s*(?::\s*([\d\-\*\,\/]+))?$/))) {
            if (m[3] === undefined)
                m[3] = 0;
            this._schedule = m[3] + ' ' + m[2] + ' ' + m[1] + ' * * *';
            this._type = 'schedule';
            return this;
        } // schedule
        if ((m = name.match(/^((?:[0-9]?\d|\*)(?:(?:[\/-][0-9]?\d)|(?:,[0-9]?\d)+)?\s*){5}((?:[0-9]?\d|\*)(?:(?:[\/-][0-9]?\d)|(?:,[0-9]?\d)+)?)?$/))) {
            this._schedule = (!m[2] ? '* ' : '') + name;
            this._type = 'schedule';
            return this;
        } // id + verifier
        if (!(m = name.match(/^([\/\!]?)(~?)([^\?]+)(\?\+(?=\s*$)|\?\-(?=\s*$)|\?\=|\?\!=|\?>\=|\?>|\?<|\?<\=|\?\?|\?\^|\?\$|\?\#|$)\s*(.*)$/)))
            return A.W(`Invalid Event '${name}'`);
        this._type = 'id';
        this._onchange = !!m[2];
        this._ack = m[1];
        this._id = m[3].trim();
        this._test = m[5].trim();
        this._check = m[4];
        return this;
    }

    execute(from) {
        switch (this._type) {
            case 'state':
            case 'exec':
            case 'eval':
                A.D('To be implemented: ' + this._type);
                break;
            case 'delay':
                return A.wait(this._time);
        }
        return A.resolve( /* A.W(`unknown action type '${this._type}'`) */ );
    }
}


class Events extends BaseActions {
    constructor(parent, alist) {
        super(parent);
        if (alist)
            for (let i of alist)
                this._list.push(new SEvent(i));
        return this;
    }
}

class SAction {
    constructor(text) {
        this._text = text;
        this._type = 'unknown';
        this._parse(text);
    }

    _parse(name) {
        let m; // evry xxx timer
        if ((m = name.match(/^\s*(\d+m)?\s*(\d+s)?\s*(\d+(?:ms)?)?\s*$/))) {
            var ts = 0;
            for (let i = 1; i < 4; ++i) {
                let s = m[i];
                if (s) {
                    while (s[s.length - 1] > '9')
                        s = s.slice(0, -1);
                    s = parseInt(s);
                    ts += s * [0, 60 * 1000, 1000, 1][i];
                }
            }
            ts = ts > 0 ? ts : 0;
            this._type = 'delay';
            this._time = ts;
            return this;
        } // exec command on system
        if ((m = name.match(/^\s*\$\s*(.+)$/))) {
            this._cmd = m[1].trim();
            this._type = 'exec';
            return this;
        } // eval javascript
        if ((m = name.match(/^\s*(\(.+\))\s*$/))) {
            this._cmd = m[1].trim();
            this._type = 'eval';
            return this;
        } // id + verifier
        if (!(m = name.match(/^\s*([^\!\&\=\~]+)(&\s*)?(!\s*)?(\~\s*|\=\+\s*|\=\-\s*|\=\!\s*|\=\?\s*|\=.+|\s*)$/)))
            return A.W(`Invalid Action '${name}'`);
        this._type = 'state';
        this._exec = m[4] ? m[4].trim() : '';
        this._ack = !!m[3];
        this._queue = !!m[2];
        this._id = m[1].trim();
        return this;
    }

    execute(from) {
        switch (this._type) {
            case 'state':
            case 'exec':
            case 'eval':
                A.D('To be implemented: ' + this._type);
                break;
            case 'delay':
                return A.wait(this._time);
        }
        return A.resolve( /* A.W(`unknown action type '${this._type}'`) */ );
    }
}

class Actions extends BaseActions {
    constructor(parent, alist) {
        super(parent);
        if (alist)
            for (let i of alist)
                this._list.push(new SAction(i));
    }

    execute(from) {
        if (this.disabled)
            return A.resolve();
        return A.seriesOf(this._list, (x) => x.execute(from), 1);
    }
}

class Link extends BaseSM {
    constructor(parent, obj, to) {
        super(obj[fields.id], obj[fields.type]);
        this._parent = parent;
        this._events = new Events(this, obj[fields.fire]);
        this._to = to;
    }
    execute(from) {
        //?
    }
}

class Scene extends BaseSM {
    constructor(parent, obj) {
        super(obj[fields.id], obj[fields.type]);
        this._parent = parent;
        this._actions = new Actions(this, obj[fields.onFire]);
        this._disabled = obj[fields.disabled];
    }
    execute(from) {
        this._actions.execute(from);
    }
}

class Event extends Scene {
    constructor(parent, obj) {
        super(parent, obj);
        this._list = new Events(parent, obj[fields.fire]);
        this._function = obj[fields.function];
        this._disabled = obj[fields.disabled];
    }
    execute(from) {
        // execute this,_function;
        this.onFire.execute(from);
    }
}

class State extends Link {
    constructor(parent, obj) {
        super(parent, obj);
        this._list = [];
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            this._list.push(new Link(this, obj[k], k));
        }
        this._onEnter = new Events(this, obj[fields.onEnter]);
        this._onExit = new Events(this, obj[fields.onExit]);
    }
    execute(from) {
        // execute this,_function;
        this.onFire.execute(from);
    }
}

class Machine extends BaseSM {
    constructor(parent, obj) {
        super(obj[fields.id], obj[fields.type]);
        this._disabled = obj[fields.disabled];
        this._list = [];
        //        this._expanded = obj[fields.expanded];
        this._auto = [];
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            if (k.startsWith('*')) {
                this._auto.push(new Link(this, obj[k], k.slice(1)));
            } else {
                this._list.push(new State(this, obj[k]));
            }
        }
    }
    execute(from) {
        // execute potential state changes;
    }
}

class Folder extends BaseSM {
    constructor(obj) {
        super(obj[fields.id], obj[fields.type]);
        this._list = [];
        //        let id = obj[fields.id];
        //        this._expanded = obj[fields.expanded];
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            switch (obj[k][fields.type]) {
                case 'machine':
                    this._list.push(new Machine(this, obj[k]));
                    break;
                case 'scene':
                    this._list.push(new Scene(this, obj[k]));
                    break;
                case 'event':
                    this._list.push(new Event(this, obj[k]));
                    break;
            }
        }
    }
}

class Folders {
    constructor(folders) {
        this._list = [];
        if (folders)
            for (let f in folders)
                this._list.push(new Folder(folders[f]));
    }

}

exports.Setter = Setter;
exports.CacheP = CacheP;
exports.ids = ids;
exports.Folders = Folders;