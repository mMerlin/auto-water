'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

var path = require('path');
// var config = require('../.private/userinfo.js');
var config = null;
var datalog = require('../lib/consoleLogging.js');

function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Collect the component id associated with each of the pins in the passed object
 *
 * 'this' is the object use to collect the ids
 *
 * @param {Object} obj pin specification object { 'pinNummber': 'pin id', ...}
 * @return {undefined}
 */
function collectProcessIds(obj) {
  /* jshint validthis: true */
  JSON.stringify(obj);
  var p;
  for (p in obj) {
    if (obj.hasOwnProperty(p)) {
      this[obj[p]] = true;
    }
  }
}

function isLoggingModuleActive(moduleName) {
  /* jshint maxcomplexity: 9 */
  var cfg, logModule, active, i;
  cfg = isNonNullObject(config) && isNonNullObject(config.logging) ? config.logging : {};
  logModule = cfg.activeModule ? path.basename(cfg.activeModule, '.js') : '';
  if (logModule === moduleName) {
    return true;
  }
  if (logModule === 'multipleLogging') {
    // config.multipleLogging.activeModule[]
    active = isNonNullObject(config.multipleLogging) && Array.isArray(config.multipleLogging.activeModule) ?
        config.multipleLogging.activeModule : [];
    for (i = 0; i < active.length; i += 1) {
      logModule = active[i] ? path.basename(active[i], '.js') : '';
      if (logModule === moduleName) {
        return true;
      }
    }
  }
  return false;
}

// https://stackoverflow.com/questions/23328902/nodeunit-testing-event-based-async-code
// var events = require('events');
// var asyncSetup = new events.EventEmitter();
//
// function async_setup(app, callback) {
//   asyncSetup.addListener('setup-complete', function () {
//     callback();
//   });
//   setTimeout(function () {
//     // if (app.result) {
//     //   throw new Error("AlreadyConfiguredAppError");
//     // }
//     // app.result = "app is configured";
//     // asyncSetup.emit('setup-complete', app.result);
//     // app();
//     asyncSetup.emit('setup-complete');
//   }, 5000);
//   return app;
// }

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports['exported properties'] = {
  setUp: function (done) {
    var cfg, ary, set, i, j;
    // Collect pin id information from config.process, to match to the events to be logged
    this.eventSource = {};
    cfg = isNonNullObject(config) && isNonNullObject(config.process) ? config.process : {};
    collectProcessIds.call(this.eventSource, cfg.pump);
    ary = Array.isArray(cfg.sensorPinSet) ? cfg.sensorPinSet : [];
    for (i = 0; i < ary.length; i += 1) {
      set = Array.isArray(ary[i]) ? ary[i] : [];
      for (j = 0; j < set.length; j += 1) {
        collectProcessIds.call(this.eventSource, set[j]);
      }
    }

    done();
  },
  'property types': function (test) {
    test.expect(8);

    test.strictEqual(typeof datalog.init, 'function', 'should provide an init method');
    test.strictEqual(typeof datalog.addSensor, 'function', 'should provide an addSensor method');
    test.strictEqual(typeof datalog.addBoard, 'function', 'should provide an addBoard method');
    test.strictEqual(typeof datalog.finalize, 'function', 'should provide a finalize method');
    test.strictEqual(datalog.init.length, 3, '3 arguments should be passed to init');
    test.strictEqual(datalog.addSensor.length, 1, 'single argument should be passed to addSensor');
    test.strictEqual(datalog.addBoard.length, 1, 'single argument should be passed to addBoard');
    test.strictEqual(datalog.finalize.length, 0, 'no arguments should be passed to finalize');

    test.done();
  },
  'console configuration': function (test) {
    /* jshint maxcomplexity: 9 */
    var cfg, base, keys, logName, i;

    cfg = isNonNullObject(config) && isNonNullObject(config.logging) ? config.logging : {};
    base = isNonNullObject(cfg.consoleLogging) ? cfg.consoleLogging : {};
    keys = Object.keys(isNonNullObject(base.traceLookup) ? base.traceLookup : {});
    // console.log('keys: ' + JSON.stringify(keys));

    test.expect(2 + (isNonNullObject(cfg.consoleLogging) ? 1 : 0) + keys.length * 2);

    test.ok(cfg.consoleLogging === undefined || isNonNullObject(cfg.consoleLogging),
      'consoleLogging must be a (non-null) object property, when it exists at all');
    test.ok(isNonNullObject(cfg.consoleLogging) || !isLoggingModuleActive('consoleLogging'),
      'A logging.consoleLogging object property is required when consoleLogging is an active module');
    if (!isNonNullObject(cfg.consoleLogging)) {
      test.done();
      return;
    }

    // validation for console logging configuration.
    test.ok(isNonNullObject(base.traceLookup), 'consoleLogging object needs a traceLookup object property');

    logName = {};
    for (i = 0; i < keys.length; i += 1) {
      test.strictEqual(this.eventSource[keys[i]], true, keys[i] + ' is not an id for a used pin');
      test.strictEqual(logName[base.traceLookup[keys[i]]], undefined,
        base.traceLookup[keys[i]] + ' is not a unique trace identifier');
      logName[base.traceLookup[keys[i]]] = true;
    }

    test.done();
  // },
  // 'console data transform': function (test) {
  //   // check (optional) data translation / scaling / transform
  //
  //   test.done();
  }
};

exports['call sequence validation'] = {
  setUp: function (done) {
    // setup here
    done();
  },
  'no init': function (test) {
    var noInitPrefix = 'Call init before calling ';
    test.expect(3);

    test.throws(function () {return datalog.finalize(); }, function (err) {
      return err instanceof Error && err.message === noInitPrefix + 'finalize';
    }, 'unexpected error (message)');
    test.throws(function () {return datalog.addSensor(); }, function (err) {
      return err instanceof Error && err.message === noInitPrefix + 'addSensor';
    }, 'unexpected error (message)');
    test.throws(function () {return datalog.addBoard(); }, function (err) {
      return err instanceof Error && err.message === noInitPrefix + 'addBoard';
    }, 'unexpected error (message)');

    test.done();
  }
};
