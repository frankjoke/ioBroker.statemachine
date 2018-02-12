/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.adapter('statemachine'),
//    assert = require('assert'),
	A = require('./myAdapter'),
//	schedule = require('node-schedule'),
//    moment = require('moment'),
//    SunCalc = require('suncalc'),
    M = require('./myMachines');


A.init(adapter,main);

function main() {
    var mf = new M.Folders(adapter.config.folders);
    A.D(A.O(mf));
    var v = 0;
    function tick() {
        A.makeState({id:'Event3', write: true},(v = 3-v),false);
        A.makeState({id:'timer', write: true},A.dateTime(),false);
    }
    tick();
    setInterval(tick,60000);
}
