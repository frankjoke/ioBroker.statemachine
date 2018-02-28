// StateMachines Classes v2.0.1 21.10.2017
/* jshint -W061 */
/*jslint node: true */
"use strict";

const schedule = require('node-schedule'),
    SunCalc = require('suncalc'),
    MA = require('./myAdapter'),
    A = MA.MyAdapter,
    Setter = MA.Setter;

class List {
    constructor() {
        return this;
    }

    add(name, item) {
        var ni = this[name];
        if (!ni)
            ni = this[name] = [];
        ni.push(item);
    }

    fireAll(name, val) {
        return A.seriesOf(this[name], (x) => x.fire(val), 1);
    }
}

const REGEXP = 'regexp',
    IDNAME = 'id',
    SCHEDULE = 'schedule',
    EVERY = 'every',
    DELAY = 'delay',
    EXEC = 'exec',
    EVAL = 'eval',
    STATE = 'state',
    UNKNOWN = 'unknown',
    MACHINE = 'machine',
    SCENE = 'scene',
    EVENT = 'event',
    ASTRO = 'astro',
    LINK = 'link',
    TIMER = 'timer',
    FOLDER = 'folder',

    F_id = ' id',
    F_default = ' default',
    // F_expanded = ' expanded',
    F_type = ' type',
    F_disabled = ' disabled',
    F_timeout = ' timeout',
    F_fire = ' fire',
    F_onFire = ' onfire',
    F_onEnter = ' onenter',
    F_onExit = ' onexit',
    F_function = ' function',
    regIdAction = /^\s*([^\/\!\&\=\~]+)(&\s*)?(!\s*)?(\/\s*)?(\~\s*|\=\+\s*|\=\-\s*|\=\!\s*|\=\?\s*|\=.+|\s*)$/,
    regEval = /^\s*(\(.+\))\s*$/,
    regExec = /^\s*\$\s*(.+)$/,
    regAstro = /^\s*@\s*([A-Z]+)\s*([\+\-]\d+)?\s*$/i,
    regDelay = /^\s*(\d+m)?\s*(\d+s)?\s*(\d+(?:ms)?)?\s*$/,
    regTimer = /^\s*(\d+h)?\s*(\d+m(?!s))?\s*(\d+s?)?\s*(\d+ms)?\s*$/i,
    regEvery = /^\s*(\d+w)?\s*(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*(\d+s?)?$/i,
    regTime = /^\s*([\d\-\*\,\/]+)\s*:\s*([\d\-\*\,\/]+)\s*(?::\s*([\d\-\*\,\/]+))?$/i,
    regSchedule = /^\s*((?:[0-9]?\d|\*)(?:(?:[\/-][0-9]?\d)|(?:,[0-9]?\d)+)?\s*){5}((?:[0-9]?\d|\*)(?:(?:[\/-][0-9]?\d)|(?:,[0-9]?\d)+)?)?$/,
    regId =
    /^\s*([^@][^\?\&\!\~\><\=\^\$#]+)([\?\&\!]?)\s*(~?)\s*(\+(?=\s*$)|\-(?=\s*$)|\=|\!=|>\=|>|<\=|<|\?|\^|\$|\#|$)\s*(.*)$/,
    regRegexp = /^\s*(\/.+\/i?)\s*([\?\&\!]?)\s*(~?)\s*(\+(?=\s*$)|\-(?=\s*$)|\=|\!=|>\=|>|<\=|<|\?|\^|\$|\#|$)\s*(.*)$/;


const stateDisabled = '._disabled',
    stateDebug = '_debugLevel';

var setter, queueAll, stq,
    ids = {},
    everys = new List(),
    schedules = new List(),
    eids = new List(),
    rids = new List(),
    astros = new List(),
    eevents = new List();

function stripFrom(from) {
    return from.startsWith('system.adapter.') ? from.slice(15) : from;
}

class MState {
    constructor(options, idfrom, last) {
        if (A.T(options) !== 'object')
            options = {
                val: options,
                ts: Date.now()
            };
        this.val = options.val;
        this.ack = options.ack;
        this.ts = options.ts !== undefined ? options.ts : Date.now();
        this.lc = options.lc;
        this.num = options.num;
        this.old = options;
        this.last = last;
        if (typeof idfrom === 'string')
            this.id = stripFrom(idfrom);
        else if (A.T(idfrom) === 'object' && idfrom.id)
            this.id = stripFrom(idfrom.id);
        return this;
    }

    toString() {
        return `MS(${A.T(this.val)=== 'symbol' ? this.val.toString() : this.val},  '${this.sfrom}', ${this.num !== undefined ? this.num : ''})`;
    }
    get from() {
        var from = this.id ? this.id : '';
        if (this.old && this.old.from) {
            if (from)
                from += ' | ' + stripFrom(this.old.from);
            else
                from = stripFrom(this.old.from);
        }
        return from;
    }
    get sfrom() {
        var from = this.from;
        return from.length > 75 ? from.slice(0, 37) + ' ... ' + from.slice(-37) : from;
    }

    hasLast(last) {
        if (last === undefined)
            last = this.last;
        if (this.old && this.old.last)
            return this.old.last === last ? true : this.old.hasLast(last);
        else if (this.old && this.old.hasLast)
            return this.old.hasLast(last);
        return false;
    }
}

class BaseSM {
    constructor(id, type, icon) {
        this._id = id;
        if (typeof id === 'string')
            ids[id] = this;
        this._type = type;
        this._parent = null;
        if (icon)
            this._icon = icon;
    }

    toString() {
        return `${this.constructor.name}(${this.id}${this.disabled ? ', disabled' : ''})`;
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

    get val() {
        return undefined;
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

    get active() {
        return !this.disabled;
    }

    fire() {}
    init() {}
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
    get parent() {
        return this._parent;
    }
    toString() {
        return `${this.constructor.name}(${this._parent}, ${this.length}, ${this.disabled})`;
    }

    get length() {
        return this._list.length;
    }

    init() {
        for (let i in this._list)
            this._list[i].init(parseInt(i) + 1);
    }

}

class SEvent {
    constructor(parent, text) {
        this._parent = parent;
        this._text = text;
        this._type = UNKNOWN;
        this._parse(text);
    }

    get parent() {
        return this._parent;
    }

    toString() {
        return `${this.constructor.name}(${this._type}, '${this._text}')`;
    }

    _parse(name) {
        name = name.trim();
        var m;
        if ((m = name.match(regEvery))) { // evry xxx timer
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
            this._type = EVERY;
            this._timer = ts;
            return this;
        }
        if ((m = name.match(regTime))) { // time
            if (m[3] === undefined)
                m[3] = 0;
            this._schedule = m[3] + ' ' + m[2] + ' ' + m[1] + ' * * *';
            this._type = SCHEDULE;
            return this;
        }
        if ((m = name.match(regAstro))) { // astro
            this._astro = m[1] + m[2];
            this._type = ASTRO;
            return this;
        }
        if ((m = name.match(regSchedule))) { // schedule
            this._schedule = (!m[2] ? '* ' : '') + name;
            this._type = SCHEDULE;
            return this;
        } // id + verifier
        if ((m = name.match(regRegexp)))
            this._type = REGEXP;
        else if (!(m = name.match(regId)))
            return A.W(`Invalid Event '${name}'`);
        else
            this._type = IDNAME;
        this._onchange = !!m[3];
        this._ack = m[2];
        this._id = m[1].trim();
        if (this._type === IDNAME && this._id.indexOf('*') >= 0) {
            this._id = '/^' + this._id.replace('.', '\.').replace(/\*/g, '.*') + '$/';
            this._type = REGEXP;
        }
        if (this._type === REGEXP) {
            var r = this._id.match(/^\s*\/(.+)\/(i)?\s*$/);
            this._regexp = new RegExp(r[1], r[2]);
        }
        this._test = m[5] ? m[5].trim() : undefined;
        this._check = m[4];
        return this;
    }

    execute() {
        return A.resolve( /* Events will not be executed */ );
    }

    init(num) {
        var e = new TheEvent(this, num);
        switch (this._type) {
            case EVERY:
                everys.add(this._timer, e);
                break;
            case SCHEDULE:
                schedules.add(this._schedule, e);
                break;
            case IDNAME:
                eids.add(this._id, e);
                break;
            case REGEXP:
                rids.add(this._regexp, e);
                break;
            case ASTRO:
                astros.add(this._astro, e);
                break;
        }
    }

    doFire(state) {
        if (this._type !== IDNAME && this._type !== REGEXP)
            return true;
        if (this._onchange && state && state.old)
            if (state.ack === state.old.ack && state.val === state.old.val)
                return false;
        if (this._ack === '&' && !state.ack)
            return false;
        if (this.ack === '!' && state.ack)
            return false;
        var last = this._test ? this._test : (state && state.old && state.old.val);
        switch (this._check) {
            case '+':
                return !!state.val;
            case '-':
                return !state.val;
            case '=':
                /* jshint -W116 */
                return state.val == last;
            case '!=':
                return state.val != last;
            case '>':
                /* jshint +W116 */
                return state.val > last;
            case '>=':
                return state.val >= last;
            case '<':
                return state.val < last;
            case '<=':
                return state.val <= last;
            case '?':
                return state.val.indexOf(last) >= 0;
            case '#':
                return state.val.indexOf(last) < 0;
            case '^':
                return state.val.startsWith(last);
            case '$':
                return state.val.endsWith(last);
            default:
                return true;
        }
        return true;
    }
}


class Events extends BaseActions {
    constructor(parent, alist) {
        super(parent);
        if (alist)
            for (let i of alist)
                this._list.push(new SEvent(this, i));
        return this;
    }
}

class SAction {
    constructor(parent, text) {
        this._text = text;
        this._parent = parent;
        this._type = UNKNOWN;
        this._parse(text);
    }

    get parent() {
        return this._parent;
    }

    toString() {
        return `${this.constructor.name}('${this._text}')`;
    }

    _parse(name) {
        let m; // delay xxx ms
        if ((m = name.match(regDelay))) {
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
            this._time = ts > 0 ? ts : 0;
            this._fun = (that) => A.wait(that._time);
            // this._type = DELAY;
            return this;
        } // exec command on system
        if ((m = name.match(regExec))) {
            this._cmd = m[1].trim();
            this._fun = (that) => {
                var fun = that._cmd;
                var args = that.parent.parent._vars;
                var nf = Array.isArray(args) ? fun.replace(/@(\d+)/g, (match, p1) => args[p1]) : fun;
                var mp = new A.Sequence();
                var mn = 0,
                    m = [];
                nf = nf.replace(/@(?!\()([\w\-\$\.]+)/g, (match, p1) => {
                    var ret = '@' + mn++;
                    mp.p = A.myGetState(p1).then(x => x.val, () => undefined).then(v => m.push(v));
                    return ret;
                });
                nf = nf.replace('@@', '@');
                nf = nf.replace(/@(\([^\(\)]+\))/g, (match, p1) => eval(p1));
                return mp.p.then(() => nf.replace(/@(\d+)/g, (match, p1) => m[p1]))
                    .then(f => A.exec(f)).then(x => x, x => x);
            };
            // this._type = EXEC;
            return this;
        } // eval javascript
        if ((m = name.match(regEval))) {
            this._cmd = m[1].trim();
            this._fun = (that) =>
                myEval(that._cmd, that.parent.parent._vars);
            // this._type = EVAL;
            return this;
        } // id + verifier
        if (!(m = name.match(regIdAction)))
            return A.W(`Invalid Action '${name}'`);
        // this._type = STATE;
        this._exec = m[5] ? m[5].trim() : '';
        this._always = !!m[4];
        this._ack = !!m[3];
        this._queue = !!m[2];
        this._id = m[1].trim();
        switch (this._exec) {
            case '~':
                this._fun = (that) => A.myGetState(that._id).then((st) => mySetState(that._queue, that._id, !st.val, that._ack, that._always));
                break;
            case '=+':
                this._fun = (that) => mySetState(that._queue, that._id, true, that._ack, that._always);
                break;
            case '=-':
                this._fun = (that) => mySetState(that._queue, that._id, false, that._ack, that._always);
                break;
            case '=!':
                this._fun = (that, from) => mySetState(that._queue, that._id, !from.val, that._ack, that._always);
                break;
            case '=?':
            case '':
            case undefined:
                this._fun = (that, from) => mySetState(that._queue, that._id, from.val, that._ack, that._always);
                break;
            default:
                if (this._exec && this._exec.startsWith('='))
                    this._exec = this._exec.slice(1).trim();
                if ((m = this._exec.match(/^\(.+\)$/)))
                    this._fun = (that, from) => A.myGetState(that._id)
                    .then((oval) => myEval(that._exec, [oval.val, from.val]))
                    .then((val) => mySetState(that._queue, that._id, val, that._ack, that._always));
                else
                    this._fun = (that) => mySetState(that._queue, that._id, that._exec, that._ack, that._always);
                break;
        }
        return this;
    }

    execute(from) {
        if (this.parent.disabled)
            return A.resolve();
        //        from = new MState(from, this._id, this);
        _D(3, `Execute "${this}" from: ${from.sfrom}`);
        return this._fun(this, from);
    }

    init() {}
}

class Actions extends BaseActions {
    constructor(parent, alist) {
        super(parent);
        if (alist)
            for (let i of alist)
                this._list.push(new SAction(this, i));
    }

    execute(from) {
        return (this.disabled) ? A.resolve() :
            A.seriesOf(this._list, (x) =>
                x.execute(from), 1).catch(e => A.W(`Actions: ${this} err: ${e}`));
    }
}

class Link extends BaseSM {
    constructor(parent, obj, to) {
        super(obj[F_id], obj[F_type]);
        this._parent = parent;
        this._events = new Events(this, obj[F_fire]);
        this._to = to;
    }
    execute(from) {
        from = new MState(from, this.id, this);
        if (this.disabled || from.hasLast())
            return A.resolve();
        _D(3, `Execute ${this} from: ${from.sfrom}`);
        from.val = this._to;
        return this.parent.parent.execute(from).catch(e => A.W(`Execute: ${this} err: ${e}`));
    }

    get active() {
        return this._parent.active;
    }
}

class Scene extends BaseSM {
    constructor(parent, obj, role, icon) {
        super(obj[F_id], obj[F_type], icon ? icon : 'lib/img/list.png');
        this._parent = parent;
        this._actions = new Actions(this, obj[F_onFire]);
        this._disabled = obj[F_disabled];
        if (this.type !== 'folder') A.addq = A.makeState({
            id: this.id,
            icon: this._icon ? this._icon : undefined,
            type: role === undefined ? 'boolean' : 'mixed',
            role: role === undefined ? 'button' : role,
            def: false,
            write: true,
        }, undefined, true);
        if (this.id !== '_init' && this.id !== '_debugLevel')
            A.addq = A.myGetState(this.id + stateDisabled).then((s) => s.val, () => this._disabled)
            .then(e => A.makeState({
                id: this.id + stateDisabled,
                type: 'boolean',
                role: 'switch',
                icon: 'lib/img/power-off.png',
                def: false,
                write: true,
            }, e, true));
    }
    execute(from) {
        from = new MState(from, this.id, this);
        if (this.disabled || from.hasLast())
            return A.resolve();
        _D(2, `Execute ${this} from: ${from.sfrom}`);
        return this._actions.execute(from).catch(e => A.W(`Execute: ${this} err: ${e}`));
    }
    init() {
        this._actions.init();
    }

}

class Event extends Scene {
    constructor(parent, obj, role) {
        super(parent, obj, role ? role : 'value', 'lib/img/flash.png');
        this._list = new Events(this, obj[F_fire]);
        this._vars = new Array(this._list.length + 1);
        this._function = obj[F_function];
        this._disabled = obj[F_disabled];
    }
    execute(from) {
        from = new MState(from, this.id, this);
        if (this.disabled || from.hasLast())
            return A.resolve();
        var vold = this._vars[0];
        if (from.num && this._vars.length > from.num)
            this._vars[from.num] = from.val;
        var that = this;
        return (this._function ? myEval(this._function, this._vars.concat(from.num)) : Promise.resolve(from.val))
            .then(v => {
                _D(2, `Set ${that}=${v} from: ${from.sfrom}`);
                if (v !== undefined) {
                    from.val = that._vars[0] = v;
                    if (v !== vold)
                        return _setState(that.id, v, true, true);
                }
            }).then(() => that._actions.execute(from).catch(e => A.W(`Execute: ${this} err: ${e}`)));
    }

    get val() {
        return this._vars[0];
    }
    init() {
        this._actions.init();
        if (A.states[this.id])
            this._vars[0] = A.states[this.id].val;
        this._list.init();
    }
}

class State extends Link {
    constructor(parent, obj) {
        super(parent, obj);
        this._list = [];
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            this._list.push(new Link(this, obj[k], k));
        }
        this._onEnter = new Actions(this, obj[F_onEnter]);
        this._onExit = new Actions(this, obj[F_onExit]);
    }
    enter(from) {
        _D(3, `Enter ${this} from: ${from.sfrom}`);
        return this._onEnter.execute(from).catch(e => A.W(`Enter: ${this} err: ${e}`));
    }
    exit(from) {
        _D(3, `Exit ${this} from: ${from.sfrom}`);
        return this._onExit.execute(from).catch(e => A.W(`Exit: ${this} err: ${e}`));
    }
    execute(from) {
        from = new MState(from, this.id);
        if (this.disabled || from.hasLast())
            return A.resolve();
        _D(3, `Execute ${this} from: ${from.sfrom}`);
        // execute this,_function;
        return this.parent.execute(from.val).catch(e => A.W(`Execute: ${this} err: ${e}`));
    }
    init() {
        this._onEnter.init();
        this._onExit.init();
    }

    get active() {
        return this.parent.list[this.parent.val] === this;
    }
}

class Timer extends State {
    constructor(parent, obj) {
        super(parent, obj);
        this._timeout = obj[F_timeout];
        let t = this.id.split('.').slice(-1)[0];
        t = t.match(regTimer);
        let ms = 0;
        for (var i = 1; i < 5; i++)
            if (t[i]) {
                let m = t[i].match(/^(\d+)/);
                ms = ms + [0, 60 * 60 * 1000, 60 * 1000, 1000, 1][i] * parseInt(m[1]);
            }
        this._time = ms;
        this._timer = null;
    }
    enter(from) {
        function timer(that) {
            that._timer = null;
            that._parent.execute({
                val: that._timeout,
                from: that.id
            });
        }
        if (this._timer)
            clearTimeout(this._timer);
        this._timer = setTimeout(timer, this._time, this);
        return super.enter(from);
    }
    exit(from) {
        if (this._timer)
            clearTimeout(this._timer);
        return super.exit(from);
    }
}
class Machine extends BaseSM {
    constructor(parent, obj) {
        super(obj[F_id], obj[F_type], 'lib/img/gear.png');
        this._disabled = obj[F_disabled];
        this._list = [];
        //        this._expanded = obj[F_expanded];
        this._auto = [];
        this._names = [];
        this._state = obj[F_default];
        this._val = undefined; // TODO
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            if (k.startsWith('*')) {
                this._auto.push(new Link(this, obj[k], k.slice(1)));
            } else {
                if (k.match(regTimer))
                    this._list.push(new Timer(this, obj[(this._names.push(k), k)]));
                else
                    this._list.push(new State(this, obj[(this._names.push(k), k)]));
            }
        }
        A.addq = A.makeState({
            id: this.id,
            type: 'number',
            role: 'value',
            icon: this._icon ? this._icon : undefined,
            state: STATE,
            min: 0,
            max: this._list.length - 1,
            def: false,
            write: true,
            states: this._list.map((x, n) => ('' + n + ':' + this._names[n])).join(';')
        }, undefined, true, false,true);
        A.addq = A.makeState({
            id: this.id + stateDisabled,
            type: 'boolean',
            role: 'switch',
            icon: 'lib/img/power-off.png',
            def: false,
            write: true,
        }, undefined, true);

    }
    execute(from) {
        from = new MState(from, this.id);
        if (this.disabled || from.hasLast())
            return A.resolve();
        _D(1, 'should switch to state ' + from.val);
        var ost = this._val;
        var nst = from.val;
        if (typeof nst === 'string') {
            nst = nst.split('.').slice(-1)[0];
            nst = this._names.indexOf(nst);
            if (nst < 0)
                return A.resolve(A.W(`Invalid state name "${from.val}" for machine '${this.id}'`));
        }
        if (nst > this._list.length)
            return A.resolve(A.W(`Invalid state name "${from.val}" for machine '${this.id}'`));
        this._val = nst;
        _D(1, `Execute ${this} statechange ${this._names[ost]}>${this._names[nst]} from: ${from.sfrom}`);
        return (this._list[ost] && ost !== nst ? this._list[ost].exit(from) : A.resolve())
            .then(() => this._list[nst].enter(from))
            .then(() => A.makeState(this.id, nst, true, true))
            .catch(e => A.W(`Machine e-err: ${this} err: ${e}`));
    }
    get val() {
        return this._val;
    }
    init() {
        for (let f in this._list)
            this._list[f].init();
        if (A.states[this.id])
            this._val = A.states[this.id].val;
        else if (this._state) {
            this._state = this._names.indexOf(this._state);
            if (this._state >= 0)
                A._setState(this.id, (this._val = this._state), true, true);
        }
    }
}

class TheEvent {
    constructor(sevent, num) {
        this.num = num;
        this.event = sevent;
        this.id = sevent._text;
    }

    fire(val) {
        var p = this.event.parent.parent;
        if (typeof val !== 'object' || !val.from)
            val = {
                val: val,
                from: '' + this.event,
            };
        val.num = this.num;
        var val1 = val.fid ? new MState(val, A.idName(val.fid)) : val;
        return p.active && this.event.doFire(val) ? p.execute(val1) : Promise.resolve();
    }
}

class Folder extends BaseSM {
    constructor(obj) {
        super(obj[F_id], obj[F_type], 'lib/img/folder.png');
        this._list = [];
        //        let id = obj[F_id];
        //        this._expanded = obj[F_expanded];
        A.addq = A.makeState({
            id: this.id + stateDisabled,
            type: 'boolean',
            role: 'switch',
            icon: 'lib/img/power-off.png',
            def: false,
            write: true,
        }, undefined, true);
        for (let k of A.ownKeysSorted(obj).filter(x => !x.startsWith(' '))) {
            switch (obj[k][F_type]) {
                case MACHINE:
                    this._list.push(new Machine(this, obj[k]));
                    break;
                case SCENE:
                    this._list.push(new Scene(this, obj[k]));
                    break;
                case EVENT:
                    this._list.push(new Event(this, obj[k]));
                    break;
            }
        }
    }
    init() {
        for (let f in this._list)
            this._list[f].init();
    }
}

/*jshint -W098 */

function myEval(fun, args) {
    var nf = Array.isArray(args) ? fun.replace(/@(\d+)/g, (match, p1) => 'a[' + p1 + ']') : fun;
    var mp = Promise.resolve();
    var mn = 0,
        m = [];
    nf = nf.replace(/@([\w\-\$\.]+)/g, (match, p1) => {
        var ret = 'ma[' + mn++ + ']';
        mp = mp.then(() => A.myGetState(p1)).then(x => x.val, () => undefined).then(v => m.push(v));
        return ret;
    });
    nf = nf.replace('@@', '@');
    return mp.then(() => {
        var res, ma = m,
            a = args;
        // A.D(`call eval(${nf}) ma=${ma}, a=${a}`);
        try {
            res = eval(nf);
        } catch (e) {
            A.W(`Error in eval of "${fun}": ${e}`);
        }
        return Promise.resolve(res);
    });
}
/*jshint +W098 */

function _setState(id, val, ack, allways) {
    if (allways === undefined)
        allways = true;
    var nid = ids[id];
    if (nid)
        return A.makeState(id, val, ack, allways);
    else {
        nid = A.sstate[id];
        if (nid) {
            if (nid.startsWith(A.ain))
                return A.makeState(id.slice(A.ain.length), val, ack, allways);

            A.states[nid] = {
                val: val,
                ack: ack
            };
            return A.setForeignState(nid, val, ack);
        }
        return A.reject(`could not find id: '${id}'`);
    }
}

function mySetState(q, id, val, ack, allways) {
    _D(3, `SetState ${q || queueAll ? 'queued ': ''} ${id} to '${val}' with ack=${ack}`);
    return (q || queueAll ? setter.add(id, val, ack, allways) : _setState(id, val, ack, allways))
        .catch((e) => A.W(`mySetState got error: ${e} on ${id} with value='${val}'`));
}


class StateMachine extends BaseSM {
    constructor() {
        super(null, 'stateMachine');
        return StateMachine;
    }
    static init(config) {
        function eevp(id, i) {
            return A.myGetState(id).
            then(x => x && i.event.parent.parent._vars ?
                    i.event.parent.parent._vars[i.num] = x.val : null)
                .catch(() => null);
        }

        ids = {};
        everys = new List();
        schedules = new List();
        eids = new List();
        rids = new List();
        astros = new List();
        eevents = new List();
        let k;
        this._folders = [];
        this._debug = config.debugLevel;
        if (A.states[A.ain + stateDebug] !== undefined)
            this.debug = A.states[A.ain + stateDebug].val;
        stq = A.wait(10);

        //        for (let i of A.ownKeys(A.objects))
        //            addSState(A.objects[i], i);
        if (config && config.folders)
            for (let f in config.folders)
                this._folders.push(new Folder(config.folders[f]));
        else
            this._folders.push(new Folder(''));

        setter = new Setter(_setState, parseInt(config.queueTime));
        queueAll = config.queueAll;

        for (k in this._folders)
            this._folders[k].init();

        var p = new A.Sequence();

        for (k in eids) {
            var l = eids[k];
            for (var i of l) {
                var id = A.sstate[i.id];
                if (!id)
                    id = A.sstate[A.ain + i.id];
                if (!id)
                    continue;
                //                console.log(k + '(' + id + '): ', i);
                // A.adapter.subscribeForeignStates(id);
                eevents.add(id, i);
                if (i.num)
                    p.add(eevp(id, i));
            }
        }

        return (ids._init && ids._init.type === SCENE ? ids._init.execute('init') : A.resolve())
            .then(() => A.seriesIn(everys, (k) => {
                setInterval((n) => everys.fireAll(n), parseInt(k) * 1000, k);
                return everys.fireAll(k);
            }, 1))
            .then(() => A.seriesIn(astros, (k) => {
                function nextSunCalc(name, delay) {
                    let n = Date.now();
                    let t = n + delay * 60 * 1000;
                    let sc = SunCalc.getTimes(new Date(t), A.C.latitude, A.C.longitude);
                    let end = 0;
                    if (sc[name]) {
                        while (sc[name] < new Date(n)) {
                            t += 60 * 60 * 1000;
                            sc = SunCalc.getTimes(new Date(t), A.C.latitude, A.C.longitude);
                        }
                        end = sc[name].valueOf();
                    }
                    return end - n;
                }

                function nextSun(name, add) {
                    setTimeout(nextSun, nextSunCalc(name, add), name, add);
                    astros.fireAll(k);
                }
                let m = k.match(/^([A-Z]+)([+-]?\d+)?/i);
                if (!m)
                    return Promise.resolve(A.W(`Invalid Astro definition "${k}"`));
                let s = SunCalc.getTimes(Date.now(), A.C.latitude, A.C.longitude);
                var n = A.ownKeys(s).filter((x) => x.toLowerCase() === m[1].toLowerCase());
                n = n.length > 0 ? n[0] : null;
                if (!n)
                    return Promise.resolve(A.W(`Invalid Astro Name "${m[1]}"`));
                var addTime = m[2] ? parseInt(m[2]) : 0;
                setTimeout(nextSun, nextSunCalc(n, addTime), n, addTime);
                return Promise.resolve();
            }, 1))
            .then(() => A.seriesIn(schedules, (s) => {
                schedule.scheduleJob(s, () => {
                    schedules.fireAll(s);
                });
                return Promise.resolve();
            }, 1))
            .then(() => ids);
    }

    static allStates(id, state) {
        var s = new A.Sequence();
        if (state) {
            if (!state.ack && id.startsWith(A.ain)) {
                _D(3, `set "${id}" to: ${A.O(state)}`);
                var sid = id.slice(A.ain.length);
                if (sid === stateDebug)
                    A.debug = (StateMachine.debug = state.val) > 2 ? true : state.val > 0 ? false : undefined;
                else if (sid.endsWith(stateDisabled)) {
                    sid = sid.slice(0, -stateDisabled.length);
                    if (ids[sid])
                        ids[sid].disabled = state.val;
                } else if (ids[sid] && ids[sid].execute)
                    s.add(ids[sid].execute(state).catch(e => A.W(`AllStates: ${id} err: ${e}`)));
                // A.D(`${id}: ${A.O(state)}`);
            }

            state = A.clone(state);
            state.old = A.states[id];
            state.fid = id;
            if (state.old && state.old.old)
                delete state.old.old;
            else if (state.old)
                A.states[id] = state;

            if (eevents[id]) {
                // _D(3, `"${id}" triggers eid with: ${A.O(state)}`);
                s.add(eevents.fireAll(id, state));
            }

            for (var r in rids)
                if (id.match(rids[r][0].event._regexp)) {
                    // _D(3, `"${id}" triggers rid with: ${A.O(state)}`);
                    s.add(rids.fireAll(r, state));
                }
        }
        return s.p;
    }

    static get ids() {
        return ids;
    }
    static get debug() {
        return this._debug;
    }
    static set debug(level) {
        level = parseInt(level);
        this._debug = A.debugLevel = level < 0 ? 0 : level > 3 ? 3 : level;
        A.debug = level > 1;
        return this._debug;
    }
}

function _D(level, text, ret) {
    if (StateMachine.debug < level)
        return;
    return level < 3 ? A.I(text, ret) : A.D(text, ret);
}

// exports.Setter = Setter;
// exports.CacheP = CacheP;
exports.StateMachine = StateMachine;
exports._D = _D;