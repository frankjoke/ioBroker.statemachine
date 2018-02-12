// StateMachines Classes v2.0.1 21.10.2017

/*jslint node: true */
"use strict";

const A = require('./myAdapter');

class SetterM {  // fun = function returng a promise, min = minimal time in ms between next function call
    constructor(fun, min) {
        if (typeof fun !=='function') throw Error('Invalid Argument - no function for Setter');
        this._efun  = fun;
        this._list  = [];
        this._current = null;
        this._min   = min || 20;
        this._enabled = false;
        return this;
    }
    static stripEx(s) { s = typeof s ===  'string' ? s.trim() : s.toString().trim(); return s.startsWith('!') ? s.slice(1).trim() : s ; }
    toString() { return `Setter(${this._min},${this._enabled},${this.length})=${this.length>0 ? this._list[0] : 'empty'}`; }
    clearall() { this._list = []; return this; }
    add(id) {
        function execute (that) {
            if (that.length>0 && !that._current) {
                that._current = that._list.shift();
                that._efun.apply(null,that._current)
                    .then(() => A.wait(that._min),e => e)
                    .then(() => execute(that,that._current = null),() => execute(that,that._current = null));
            }
        }
    
        const args = Array.prototype.slice.call(arguments);
        if (this._enabled && (typeof id !== 'string' || !id.startsWith('!'))) {
            this._list.push(args);
            if (this._list.length === 1)
                execute(this);
            return this;
        }
        if (typeof id === 'string' && id.startsWith('!'))
            args[0]=id.slice(1);
        return this._efun.apply(null,args);
    }
  get min() { return this._min; }
  set min(y) { this._min = y>5 ? y : 5;}
  get length() { return this._list.length; }
  get enabled() { return this._enabled; }
  set enabled(y) { this._enabled = !! y;}
}

class MState {
    constructor(options,afrom) {
        if(options===undefined || A.T(options)!=='object')
            options = {val:options};
            this.val = options.val;
            this.ack = options.ack;
        this.ts =  options.ts !== undefined ? options.ts : Date.now();
            this.lc = options.lc;
            this.from = options.from;
            this.num = options.num;
            this._obj = options._obj;
        if(typeof afrom === 'string')
            this.addFrom(afrom);
        return this;
    }

    addFrom(from) { return (this.from = from + (this.from ? ' | ' + this.from : '')) ;}
    toString() { return `MS(${A.T(this.val)=== 'symbol' ? this.val.toString() : this.val}, ${this.stime}, '${this.sfrom}', ${this.num !== undefined ? this.num : ''})` ; }
    get sfrom() { return this.from.length>52 ? this.from.slice(0,25)+' ... '+ this.from.slice(-25) : this.from; }
//    get lfrom() { let f = this.from.split(' | ')[0]; return f.startsWith('e:') ? f.slice(2) : f ; }
    get stime() {
        var t = new Date(this.ts);
        const ts = t.toTimeString().slice(0,8);
        t = (''+t.getMilliseconds());
        return ts +'.'+'0'.repeat(4-t.length)+t; 
    }
//    get time() { return this.ts; }
//    set time(y) { this.val = y;}
}

class SmBase {
    constructor(name,machines,cn) {
        const sm = cn === 'StateMachine';
        this._baseName  = cn ? cn : 'SmBase';
        A.A(typeof name !== 'string',name + ' err: invalid name:'+A.O(name,1));
        this._name = name.trim();
//        A.A(!(machines instanceof StateMachine),`${this._baseName} err: invalid type of Machines: ${A.O(machines,1)}`); 
        if (machines)
            this._baseMachine = machines;
        if(!sm && cn) {
            A.A(this._baseMachine._items.get(name),this._baseName + ' err: Machine has already item "'+name+'"');
            this._baseMachine._items.set(name,this);
        }
        this._val = null;
        this._list = [];
        this._listeners = [];
        return this;    
    }

    static setter(a,b,c) {return Promise.resolve(this.stSetter.add(a,b,c).length);}
    static printArgs() {return A.D(`printArgs(${Array.prototype.slice.call(arguments)})`);}
    static toggleState(id) {return this.mGst(id).then(st =>  st.notExist ? Promise.reject() : this.setter(id,!st.val));}
    static readState(id) { return this.mGst(id).then(st => st.notExist ? undefined : st.val);}
    static mGst(id) { // Get an id or if nothing returned try to get 'SmBase.instanz'+id
        id = SetterM.stripEx(id);
        return A.gst(id)
            .then(x => x ? x : A.gst(SmBase.instanz+id), () => A.pGst(SmBase.instanz+id))
            .then(x => x ? x : A.W(`Could not get state for ${A.O(id)}`,null),() => A.W(`Could not get state for ${A.O(id)}`,null));
    }
    get machines() { return this._baseMachine; }
    set machines(y) { return (this._baseMachine = y); }
    get type() { return this._baseName; }
    get name() { return this._name; }
    set name(n) { this._name = n; }
    get val() { return this._val; }
    set val(y) { this._val = y;}
    get sname() { return this.machines.name + '.' + this.name; }
    get items() { return this.machines._items; }
    get list() { return this._list; }
    get lname() { return SmBase.instanz+this.sname; }

    run() { return Promise.resolve(A.W('.run of SmBase should never happen!')); }
    toString() { return this.type+'('+this.name+')'; }
    getMachine(m) { return this.machines.getMachine(m); }
    getDebug(l) { return this.machines.getDebug(l); }
    getVariable(v) { return this.machines.getVariable(v); }

    execute(st) {
        const nst = new MState(st,this.name);
    //    A.D(`${this}.execute ${nst}`);
        return this.run(nst)
            .then(r => r === SmBase.ExitRun ? Promise.resolve(null) : (nst.val = this.val,
                A.seriesOf(this._listeners.filter((ni) => !(ni.item instanceof SmState) || ni.item.isActive), 
                    (l) => (nst.num=l.num,l.item.execute(nst)),-1)))
            .catch(e => A.W(`${this}.execute catch: ${A.O(e)}`));
    }
    
    setItem(item,val,num) {
        item = this.items.get(item.trim());
        if (!item) return;
        const nst = new MState({val:val,num:num,_noFun:true},'execute:'+item.name);
        A.D(`${item}.executeItem ${nst}`);
        return item.run(nst)
            .catch(e => A.W(`${item}.execute catch: ${A.O(e)}`));
    }

    runAction(action,st) {
        var sa;
        switch(A.T(action)) {
            case 'function':        
                if(this.getDebug(2))
                    A.D(`SmAction(${action}), from=${st}`);
                return Promise.resolve(action(st.val,this,st))
                    .catch(e => A.W(`${action}.runAction catch1: ${A.O(e)}`));
            case 'array':
                return A.seriesOf(action,x => this.runAction(x,st),-1)
                    .catch(e => A.W(`${action}.runAction catch2: ${A.O(e)}`));
            case 'string':
                action = action.trim();
                break;
            default:
                return Promise.resolve(A.W(`runAction invalid action type: ${A.T(action)}=${action}; st=${st}`));
        }    
        if(this.getDebug(2))
            A.D(`SmAction(${action}) st=${st}`);
        var onoff = action.slice(-1),
            id = action.slice(0,-1).trim(),
            val = SmBase.Empty; // st.val === undefined ? SmBase.Empty : st.val;
        if((sa=action.match(/^\s*wait\:\s*(\d+)\s*$/))) return A.wait(parseInt(sa[1]));
        if((sa=action.match(/^\s*exec\:\&\s*(.+)$/))) return Promise.resolve(A.exec(sa[1].replace(/\$val\$/g,''+st.val)));
        if((sa=action.match(/^\s*exec\:\s*(.+)$/))) return A.exec(sa[1].replace(/\$val\$/g,''+st.val));
        switch (onoff) {
            case '-': val = false; break;
            case '+': val = true; break;
            case '~': val = SmBase.Toggle; break;
            case '!': val = !st.val; break;
            case '?': val = st.val; break;
            default:
                sa = action.split('=');
                if (sa.length===2) {
                    id = sa[0].trim();
                    val = sa[1].trim();     //  A.D(`runAction ${action} = ${val}, ${arg}, ${from}`,val = arg);
                } else id = action;
                break;
        }
        const nst = new MState(st);
        if (val !== SmBase.Empty)
            nst.num = val;
        val = nst.val = val === SmBase.Empty ? nst.val : val;
        sa = this.items.get(id);
        while (sa && sa instanceof SmAction && typeof sa._action === 'string') {
            id = sa._action.trim();
            sa = this.items.get(id);
        }
        if (sa) {
            if (sa instanceof SmAction) {
                return sa.runAction(sa._action,nst);
            }
            if (sa instanceof SmState) {
                val = sa.name.split('.')[1];
                sa = sa._machine;
            }
            if (sa instanceof SmMachine) {
                var stt = sa._states.get(val);
                nst.num = val;
                 return stt ?
                    sa.setState(nst)
                        : (typeof val === 'boolean' ? sa.enable(val) 
                                : Promise.resolve(A.W(`runAction Wrong action: '${action} State ${val} not found in ${sa}'`)));
            }
            if (sa instanceof SmVariable || sa instanceof SmEvent) {
                if(val !== SmBase.Empty)
                    nst.val = sa.val = val;
                nst.num = -1;
                return sa.execute(nst);
            }
            if (typeof sa._action === 'function')
                return Promise.resolve(sa._action(val === SmBase.Empty ? null : val, sa, st))
                        .catch(e => A.W(`${action}.runAction catch3: ${A.O(e)}`));
        }
        if(this.getDebug(2))
            A.D(`Set ${A.O(id,1)} to ${val.toString()}`);
        if(id === '_debug')
            return Promise.resolve(this.machines._debug = val);
        return (val === SmBase.Toggle ? SmBase.toggleState(id) : SmBase.setter(id,val))
            .catch(e => A.W(`${action}.runAction catch4: ${A.O(e)}`));
    }
    
    addListener(what,num) { 
        var options = {}, test = true, idd = what, t,l;              //        if (this.getDebug(2)) A.D(`${this}.addListener for ${A.O(what)} with ${num}`);
        switch(A.T(what)) {
            case 'array':
                for(t of what) 
                    this.addListener(t,num);
                return true;
            case 'string':
                idd = what.trim();
                if (this.items.has(idd)) {
                    var there = this.items.get(idd);
                    A.A( !there, `addListener Error: wanted to add wrong listeners ${this} to ${idd}`);
                    for (l of there._listeners) 
                        if (l.item === this && l.num === num) return;
                    return there._listeners.push({item:this, "num":num});
                }
                if((t=idd.match(/^astro\:\s*([a-zA-Z]{4,})\s*(([\+\-])\s*(\d+))?$/))) {
                    options = {astro:t[1]};
                    if(t[2]) options.shift = parseInt(t[3]+t[4]);
                } else if((t=idd.match(/^\s*every\:\s*(\d+)\s*(h|m?s?)$/))) {
                    options = parseInt(t[1]) * (t[2]==='s' ? 1000 : (t[2]==='m' ? 60000 : (t[2]==='h' ? 3600000 : 1)));
                } else if(idd.match(/^((\d\d?\s*)(,\s*\d\d?\s*)*)|\*(\s*\:((\s*\d\d?\s*)(,\s*\d\d?\s*)*)|(\s*\*)){1,2}$/)) {
                    t = idd.split(':');
                    options = {time: {}};
                    t.forEach((str,index) => {
                        str = str.trim();
                        var item = ['hour','minute','second'][index];
                        if (str === '*') return;
                        if (str.indexOf(',')<0) return (options.time[item]=parseInt(str));
                        options.time[item]=str.split(',').map(x => parseInt(x.trim()));
                    });
                } else {
                    while(idd.length>0 && test) {
                        l = idd.slice(-1);
                        t = idd;
                        idd = t.slice(0,-1).trim();
                        switch(l) {
                            case '-': options.val = false; break;
                            case '+': options.val = true; break;
                            case '!': options.change = 'ne'; break;
                            case '~': options.change = 'all'; break;
                            case '$': options.ack = 'false'; break;
                            case '&': options.ack = 'true'; break;
                            default:
                                idd = t;
                                test = false;
                                break;
                        }
                    }
                    if (idd.startsWith('/') && idd.endsWith('/'))
                        idd = new RegExp(idd.slice(1,-1));
                    options.id = idd;
                }
                idd = options;
                break;
            case 'object':
                A.A(!(what.id || what.name || what.time || what.astro),`addListener has wrong object to process: ${A.O(what)}`);
                idd = what;
                break;
            case 'regexp':
                idd = what;
                break;
            default:
                A.A(true,`wrong SmVariable source-id ${A.O(what)}`);
        }
        var lname = A.O(idd);
        const that = this;
        t =this.machines._ioevents.get(lname);
        if (!t) {
            t = [];
            this.machines._ioevents.set(lname,t);   //          A.D(`CReateOnListenerIoBroker ${lname}=${A.O(idd)}(${num})`);
            if (this.getDebug(2))
                A.D(`${this}.addListener for ${A.T(idd)+' '+A.O(idd)} with ${num}`);
            if (typeof idd === 'number') 
                setInterval(() => A.seriesOf(t, fu => fu('I'+idd),-1), idd);
            else 
                on(idd,(obj) => A.seriesOf(t, fu => fu(obj),-1));
        }
        if (typeof idd === 'number')
            lname = what;
        t.push(function onIoBrokerEvent(obj) { 
            const nst = new MState(  obj && obj.state ? obj.state : obj,lname);
            if (nst.val === undefined) nst.val = nst.ts;
            if (obj && obj.oldState && obj.oldState.lc)
                nst.lc = obj.oldState.lc;
            nst._obj = obj; //     A.D(`event ${that} with ${A.O(obj)}:${nst}`);
            if (num!==undefined)
                nst.num = num;
            return that.execute(nst).catch(e => A.W(`${this}.execute on event catch: ${A.O(e)}`));
        });
    }
    
}


class StateMachine extends SmBase {
    constructor (options) {
        super(options && typeof options.name === 'string' ? options.name.trim() : 'StateMachine',null,'StateMachine');
        this.machines = this;
        this._options = options || null;
        this._items =   new Map();
        this._debug =   0;
        this._ioevents =    new Map();
        SmBase.stSetter =   new SetterM(A.sst,50);
        SmBase.ExitRun =    Symbol('exitRun');
        SmBase.Toggle =     Symbol('toggle');
        SmBase.Empty =      Symbol('empty');
        SmBase.instanz =    A.ain;
        if (options)  this.init(options);
        return this;
    }
    getDebug(l) { return typeof l === 'number' ? this._debug>=(l>0 ? l : 1) : this._debug; }
    getMachine(machine) {
        const m = this._items.get(machine.trim());
        return m && m instanceof SmMachine ? m : undefined;
    }
    getActiveState(machine) {
        const m = this.getMachine(machine);
        return m  && m._activeState ? m._activeState : undefined;
    }
    getVariable(variable) {
        const v = this._items.get(variable);
        return v && v.val !== undefined ? v.val : undefined;
    }
    _preInit(options,Fun) {
        A.A(!options || !Fun,`StateMachine.preInit has no valid definition (${options}) or ${Fun}`);
        for(var i in options) {
            var name = i.trim();
            if (this._items.has(name)) {
                A.W(`StateMachine item '${name}' already defined. 2nd definition ignored!`);
                continue;
            }
            var option = options[i];
            var item = new Fun(name,this);
            item._option = option;
        }
    }
    
    init(options) {
        A.A(!options,`Empty options in SateMachine.init(${A.O(options)})`);
    
        if (options.actions) this._preInit(options.actions,SmAction);
        if (options.events) this._preInit(options.events,SmEvent);
        if (options.variables) this._preInit(options.variables,SmVariable);
        if (options.machines) this._preInit(options.machines,SmMachine);
    
        if(options.name)
            this.name = options.name.trim();
        if (options.debug !== undefined)
            this._debug = options.debug || 0;
        if (options.setdelay) {
            var s = parseInt(options.setdelay);
            s = !s || isNaN(s) ? 0 : s;
            SmBase.stSetter.min = s;
            SmBase.stSetter.enabled = s>0;
        } else
            SmBase.stSetter.enabled = false;
        A.A(!this._items.size,'State machine includes no definitions, cannot start!');
        if (this.getDebug(1))
            A.D(`StateMachione initialize with name '${this.name}', debug=${this._debug} and setter:${SmBase.stSetter}`);
        var t = [];
        for(var i of this._items.values())
            t.push(i);
        
        return A.seriesOf(t.reverse(),x => Promise.resolve(x.init(x._option)),1)
            .then(x => {
                const init = this._items.get('_init');
                if (init && init instanceof SmAction) {
                    return init.execute(new MState({val:'_init'},'_init'));
                }
                return x;
            })
            .then(() => on({id: new RegExp('^'+SmBase.instanz+this.name+'\.'), change:'ne', ack:false, fromNe:'system.adapter.'+SmBase.instanz.slice(0,-1) },(obj) => {
        //        A.W('Command for StateMachine ' +obj.id+ ' auf '+A.O(obj.state));
            if (!obj || !obj.state)
                return;
            var id = obj.id,
                val = obj.state.val,
//                from = obj.state.from,
                ie = id.endsWith('._enabled'),
                nst = new MState(obj.state);
            id = id.split('.').slice(-1)[0];
            var m = this._items.get(id);
            if (m && m instanceof SmMachine && m.list[val]) {
                if(m.getDebug(2))
                    A.I(`Command for StateMachine ${id} auf ${A.O(obj.state)}`);
                nst.num = m.list[val];
                return ie ? (m._enabled = val) : m.setState(nst);
            } else if(m && !ie && m instanceof SmVariable) {
                nst.val = m.val = val;
                return m.execute(nst);
            }
            return null;
        })).catch(e => A.W(`${this}.init catch: ${A.O(e)}`));
    }

}

class SmMachine extends SmBase {
    constructor(name, machines) {
        super(name,machines,'SmMachine');

        this._fun = null;
        this._activeState = null;
        this._enabled = true;
        this._states = new Map();
        return this;
    }
    enable(bool) {
        this._enabled = bool;
        if(this.getDebug(1))
            A.D(`${this} will be ${bool?'enabled':'disabled'}`);
        return SmBase.setter(this.lname+'._enabled',{val:bool, ack:false},false)
            .catch(e => A.W(`${this}.enable catch: ${A.O(e)}`));
    }

    init(option) {
        switch(A.T(option)) {
            case 'function': this._fun = option; return true;
            case 'array':
                A.A(option.length<=1 ,`${this} array len too short ${A.O(option)} !`);
                const mf = this.items.get(option[0]);
                A.A(!mf || typeof mf._option !== 'function',`${this} array len or no function ${A.O(mf)} !`);
                this._option = option = mf._option.apply(null,option.slice(1));
                break;
            case 'object': break;
            default:
                A.W(`SmMachine ${this.name} has wrong config ${A.O(option)}`);
                return false;
        }
        var def = null;
        this._all = option._all;
        for(var s in option) {
            var sname = s.trim();
            if (sname === '_all')
                continue;
            var soption = option[s];
            if(typeof soption === 'string')
                soption = soption.trim();
            A.A(A.T(soption) !== 'object' && A.T(soption) !== 'string',`wrong state definition ${soption} in ${this}`);
            if (sname === '_default') {
                A.A(typeof soption !== 'string',`wrong _default state _definition in ${A.O(soption)}`);
                def = soption;
                continue;
            }
            var state = new SmState(this.name + '.' + sname,this.machines);
            this._states.set(sname,state);
            this.list.push(sname);
            state._machine = this;
            state._option = soption;
            state._shortname = sname;
            state._all = this._all;
        }
        if (def)
            this._activeState = this._states.get(def);
        for(s of this._states.values()) 
            s.init(s._option);
        if (this.list.length<2) 
            return Promise.resolve(A.W(`${this} err: not engough (<2) states!: ${A.O(option)}`));
        if (!this._activeState)  {
            if (this.list.length>0)
                this._activeState = this._states.get(this.list[0]);
            A.W(`No '_default' state defined in ${this}, ${this._achiveState} defined as activeState!`);
        }
        var mx = this.list.length-1,  ns = '', ds = null, da = false;
        s = '';
        const mn = this.sname;
        for (var i in this.list) {
            s += ';'+ i + ':' + this.list[i];
            ns += ';' + i;
        }
        ns = ns.slice(1);
        s = s.slice(1);
        if (this.getDebug(2))
            A.D(`${this}.init create state ${mn} with ${s}`);
        this._enabled = true;
        var va = null;
        return SmBase.mGst(SmBase.instanz+mn)
            .then(x => {
                if (x.val !== undefined) {
                    va = x.val;
                    ds = this._states[va];
                    da = true;
                }
            }, () => Promise.resolve())
            .then(() => SmBase.mGst(SmBase.instanz+mn+'._enabled'))
            .then(x => this._enabled = (x.val !== undefined) ? x.val :  this._enabled, () => true)
            .then(() => A.cst(mn, va, true, {type: 'number',name:SmBase.instanz+mn, unit: '',role: 'state',write:true,max:mx,min:0,states:s,desc:this.name+`,${ns},${this.list.join(';')}`},{}))
            .then(() => ds ? this.setState({num:ds,from:'init' ,always:da}) : null)
            .then(() => A.cst(mn+'._enabled', this._enabled, true, {type: 'boolean',name:SmBase.instanz+mn+'._enabled', unit: '',role: 'state',write:true},{}))
            .catch(e => A.W(`${this}.init catch: ${A.O(e)}`));
    }
    
    run(st) {
        if (!st.num) 
            return Promise.resolve();
        const num = st.num.split('.');
        if (num.length !== 2)
            return Promise.resolve();
        const nst = new MState(st);
        nst.num = num[1].trim();
        const m = this.getMachine(num[0]);
        return (m ? m.setState(st) : Promise.reject())
            .catch(e => A.W(`${this}.run-setState catch: ${A.O(e)}`));
    }
    
    setState(st) {
        if (!this._enabled && !st.always)
            return Promise.resolve();
        var to = st.num.trim();
        if (to.indexOf('.')>0) 
            to = to.split('.')[1].trim();
        const t = this._states.get(to);
        A.A(!t,`setState Error: ${this} has no state '${to}'!`,this);
        const f = this._activeState;
        const fn = (f ? f._shortname : 'undefined');
        if (f===t && !st.always && !t._timer)
            return Promise.resolve(this.getDebug(1) ? A.D(`moveToState equal ${f} = ${st}`) : null);
        A.A(!t,`moveToState in ${this} to ${to} invalid to: ${A.O(t)}`);
    
        if (this.getDebug(1)) 
            A.I(`${this.name}.${to} was ${fn}: ${st.from}`);
    
        return ( f ? f.onExit(st).then(() => f.onChange(st)) : Promise.resolve())
            .then(() => t.onEnter(st))
            .then(() => t.onChange(st))
            .then(() => A.sst(this.lname,this.list.indexOf(to),false))
            .catch(e => A.W(`${this}.setState catch: ${A.O(e)}`));
    }

}

class SmVariable extends SmBase {
    constructor (name, machines, ini) {
        super(name,machines,'SmVariable');
        this._fun = null;
        if (ini) this.init(ini);
        return this;
    }

    init(option) {
        if(Array.isArray(option)) {
            const l = option.slice(0,-1);
            this._fun = option.slice(-1)[0];
            if (typeof this._fun !== 'function' || l.length<1)
                 A.W(`Variable Definition Warning ${this}: ${this.name} has no funcion or no values to process: ${A.O(option)}`);
            else for (var i in l) {
                this.addListener(l[i],i);
                this.list.push(null);
            }
        } else 
            this.addListener(option);
        const mn = this.sname;
        if (this.getDebug(3))
            A.D(`${this}.init create variable ${mn}`);
        this.val = null;
        return SmBase.mGst(SmBase.instanz+mn)
            .then(x => this.val = x && x.val !== undefined ? x.val : null, () => null)
            .then(() => A.cst(mn, undefined, true, {state:'state', role:'value', type: 'mixed', name:SmBase.instanz+mn, write:true, desc:'StateMachine Variable '+mn}))
            .then(() => A.sst(mn, {val: this.val, ack: true}))
            .catch(e => A.W(`${this}.init catch: ${A.O(e)}`));
    }
    
    run(st) {
        if (this._fun && st.num>=0 && st.num< this.list.length) {
                this.list[st.num] = st.val;
                if (this.getDebug(3)) A.D(`${this} ${st.num}=${st.val} ? ${st.sfrom}`);
        }
        const r = this._fun ? this._fun(this.val,this,st) : st.val;
        return (r instanceof Promise ? r : Promise.resolve(r))
            .then(x => {
                if (x !== this.val && x !== SmBase.Empty  && x !== SmBase.ExitRun) {
                    this.val = x;
                    return A.sst(this.sname, {val: this.val, ack: false})
                        .then(x => this.getDebug(2) ? A.D(`${this} val = ${this.val}`,x) : x);
                }
                return Promise.resolve(SmBase.ExitRun);
            }).catch(e => A.W(`${this}.run catch: ${A.O(e)}`));
    }

}
    
class SmState extends SmBase{
    constructor(name, machines, ini) {
        super(name,machines,'SmState');
    
        this._all = null;
        this._machine = null;
        if (ini) this.init(ini);
        return this;
    }

    get isActive() { return this._machine._activeState === this; }

    addEvent(to, event) {
        const m = this._machine;
        to = to.trim();
        const t = m._states.get(to);
    //    A.D(`${this}.addEvent '${event}' to state ${t} ${to} not existing in ${m.name}`,false);
        if (!t) return A.W(`${this}.addEvent '${event}' to state ${t ? t : to} not existing in ${m.name}`,false);
        return this.addListener(event,to);
    }
    onExit(st) {
        this._machine._activeState = null;
        if (this._timeout)
            clearTimeout(this._timeout);
        this._timeout = null;
        const nst = new MState(st,`exit(${this.name})`);
        return (this._onExit ? this.runAction(this._onExit,nst) : Promise.resolve())
            .catch(e => A.W(`${this}.onExit catch: ${A.O(e)}`));
    }
    onChange(st) {
        var nst = new MState(st,`_onState(${this.name})`);
        nst.val = this.isActive;
        return (this._onState ? this.runAction(this._onState,nst) : Promise.resolve())
            .then(() => {
                nst = new MState(st,`_onNotState(${this.name})`);
                nst.val = !this.isActive;        
                
            }).then(() => this._onNotState ? this.runAction(this._onNotState,nst) : false)
            .catch(e => A.W(`${this}.onStates catch: ${A.O(e)}`));
    }
    onEnter(st) {
        const nst = new MState(st,`enter(${this.name})`);
        nst.val = this.name;
        if (this._timer) {
            if (this._timeout)
                clearTimeout(this._timeout);
            const tst = new MState(st);
            tst.num = this._timerState; tst.from = '_timeout:'+this._timer;
            this._timeout = setTimeout(function(that) {
                that._timeout = null; 
                that._machine.setState(tst);
            }, this._timer, this);
        }
        return (this._onEnter ? this.runAction(this._onEnter,nst) : Promise.resolve())
            .then(() => this._machine._activeState = this)
            .then(() => A.seriesOf(this._listeners.filter((ni) => !(ni.item instanceof SmState) || ni.item.isActive), (l) => (nst.num=l.num,l.item.execute(nst)),-1))
            .catch(e => A.W(`${this}.onEnter catch: ${A.O(e)}`));
    }
    execute(st) {
        if (!this.isActive || !this._machine._enabled) //         A.W(`${this}.execute '${A.O(st)}'`);
            return Promise.resolve(false);
        return this._machine.setState(st)
            .catch(e => A.W(`${this}.execute catch: ${A.O(e)}`));
    }
    
    init(option) {
        var e;
        if (A.T(option)==='string') {
            this._machine.addListener(option.trim(),this.name);
            option = {};
        }
        if (this._machine._all) {
            for(e in this._machine._all) {
                var aa = this._machine._all[e];
                switch(e) {
                    case '_onState':
                    case '_onNotState':
                    case '_onEnter':
                    case '_onExit':
                        option[e]=aa;
                        break;
                    default:
                        this.addEvent(e,aa);
                }
            }
        }
        const st = this._machine.name;
        const k = this._shortname;
        for(e in option) {
            var ea = option[e];
            switch(e) {
                case '_timeout':
                    var t = ea.split(':');
                    A.A(t.length!==2 || (parseInt(t[1])>0)===false,`Timer in ${st}.${k} has incorrect definition '${ea}'`);
                    this._timer = parseInt(t[1]);
                    this._timeout = null;
                    this._timerState = t[0];
                    break;
                case '_onState':
                case '_onNotState':
                case '_onEnter':
                case '_onExit':
                    this[e] = ea;
                    break;
                case '_default':
                    this._machine._activeState = this;
                    this._default = ea;
                    break;
                default:
                    this.addEvent(e,ea);
                    break;
            }
        }
    }

}

class SmEvent extends SmBase{
    constructor(name, machines, ini) {
        super(name,machines,'SmEvent');
        this._fun = null;
        if (ini) this.init(ini);
        return this;
    }
    
    init(option) {
        if(A.T(option)!=='array') 
            return this.addListener(option);
        const f = option.slice(-1)[0];
        var l = option;
        if (typeof f === 'function') {
            this._fun = f;
            l = l.slice(0,-1);
        }
        if (l.length< 1) return A.W(`Event Definition Error: SmEvent has no values to process: ${this}=${A.O(l)}, ${A.O(f)}`);
        l.forEach((v,i) => (this.list.push(null),this.addListener(v,i)));
    }
    
    run(st) {
        if (this._fun && st.num>=0 && st.num< this.list.length) {
                this.list[st.num] = st.val;
                if (this.getDebug(3)) A.D(`${this} ${st.num}=${st.val} ? ${st.sfrom}`);
        }
        return Promise.resolve(this._fun ? this._fun(this.val,this,st) : st.val).then(x => this.val = x)
            .then(x => (!x && this._fun)  ? SmBase.ExitRun : true )
            .catch(e => A.W(`${this}.run catch: ${A.O(e)}`));
    }
}


class SmAction extends SmBase{
    constructor(name, machines, ini) {
        super(name,machines,'SmAction');
        this._action = null;
        if (ini) this.init(ini);
        return this;
    }

    init(option) {
        switch(A.T(option)) {
            case 'function':
            case 'array': this._action = option; break;
            case 'string': this._action = option.trim(); break;
            default:
                return A.W(`Action definition Err: Action needs a string, function, array or {id/val} object: ${A.O(option)}`);
        }
        const ma = this.name.match(/^\s*e\:\s*(.+)$/);
        if (ma) 
            this.addListener(ma[1].trim());
    }
        
    run(st) { return this._action ? this.runAction(this._action,st).catch(e => A.W(`${this}.run catch: ${A.O(e)}`)) : Promise.resolve(); }   
}

exports.Setter = SetterM;
exports.MState = MState;
exports.StateMachine = StateMachine;