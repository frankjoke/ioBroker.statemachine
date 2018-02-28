// yjshint -W097  jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.adapter('statemachine'),
    //    assert = require('assert'),
    MA = require('./myAdapter'),
    A = MA.MyAdapter,
    //	schedule = require('node-schedule'),
    //    moment = require('moment'),
    M = require('./myMachines'),
    SM = M.StateMachine;

A.init(adapter, main);
A.allStates = SM.allStates;

/*jshint -W098 */

function main() {
    var mf = SM.init(adapter.config);
    var mstates = A.sstate;
    var ids = SM.ids;
    var v = 0;
    var s = new A.Sequence(mf);
    s.p = A.makeState({
            id: '_debugLevel',
            //        state: 'state',
            role: 'level',
            write: true
        }, SM.debug, false);
    s.p = A.makeState({
            id: 'Event3',
            state: 'state',
            role: 'value',
            write: true
        }, 0, false);
    s.p = A.makeState({
            id: 'timer',
            state: 'state',
            role: 'value',
            write: true
        }, 0, false);
    s.p.then(() => A.I('started'));
    setInterval(() => A.makeState('Event3', (++v > 3 ? (v = 0) : v), false), 29000);
    setInterval(() => A.makeState('timer', new Date().getSeconds(), false), 10000);
}
