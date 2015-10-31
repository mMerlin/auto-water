/*
 * auto-water
 * https://github.com/mMerlin/auto-water
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

// This unit test file can (will) only check the contents of the process and logging properties exported
// from the userinfo package file.  The remaining properties need datalogging package implementation
// specific details, and are better checked by the package specific unit tests.

var cfgFile;
// cfgFile = '.private/notexist';
// cfgFile = '.private/empty.js';
// cfgFile = '.private/badbase.js';
// cfgFile = '.private/emptybase.js';
// cfgFile = '.private/mingood.js';
// cfgFile = '.private/badnulls.js';
// cfgFile = '.private/badMtStrings.js';
// cfgFile = '.private/badNegOne.js';
// cfgFile = '.private/badFloats.js';
// cfgFile = '.private/badMtObjects.js';
// cfgFile = '.private/badMtArrays.js';
// cfgFile = '.private/badNested01.js';
// cfgFile = '.private/badpump01.js';
// cfgFile = '.private/badpump02.js';
// cfgFile = '.private/badpump03.js';
// cfgFile = '.private/badpump04.js';
cfgFile = '.private/userinfo.js';

var fs = require('fs');
var path = require('path');
try {
  /*jslint stupid: true */
  // In this context, synchronous check is reasonable here, and implementation
  // of asynchronous would be a pain.
  if (!fs.statSync(cfgFile).isFile()) {
    cfgFile = '.private/mingood.js';
  }
  /*jslint stupid: false */
} catch (e) {
  cfgFile = './.private/mingood.js';
}
console.log('Using configuration file "' + cfgFile + '"');
// convert to absolute path to handle difference between relative from CWD and relative
// from node.js require path when running nodeunit tests in the test [sub] directory
cfgFile = path.resolve(cfgFile);
console.log('Using configuration file "' + cfgFile + '"');

var userinfo = require(cfgFile);

function isInteger(val) {
  return parseInt(val, 10) === parseFloat(val);
}

function isNonNegativeInteger(val) {
  return isInteger(val) && val >= 0;
}

function isComponentId(val) {
  return typeof val === 'string' && val.length > 0;
}

function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * return the passed argument, or an empty object, if the passed argument is not
 * a 'normal' object
 *
 * @param {object} object       variable to check (and return)
 * @return {object}
 */
function existingOrEmptyObject(obj) {
  return isNonNullObject(obj) ? obj : {};
}

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

exports['configuration'] = {
  setUp: function (done) {
    this.process = existingOrEmptyObject(userinfo.process);
    this.logging = existingOrEmptyObject(userinfo.logging);

    // constants for limit checks
    this.minSensorPeriod = 10;
    this.maxAnalogValue = 1023;
    //IDEA this.minDigitalPin = 2;//do not use 0,1 pins used for firmata communications

    done();
  },// ./function setUp(done)
  'process configuration': function (test) {
    var cfg, val;
    cfg = this.process;
    test.expect(1 + (isNonNullObject(userinfo.process) ? 9 : 0));

    test.ok(isNonNullObject(userinfo.process), 'userinfo should have a process property object');
    if (!isNonNullObject(userinfo.process)) {
      test.done();
      return;
    }

    test.ok(isInteger(cfg.sensorPeriod) && cfg.sensorPeriod >= this.minSensorPeriod,
      'should have integer sensorPeriod not less than ' + this.minSensorPeriod);
    val = isInteger(cfg.sensorPeriod) && cfg.sensorPeriod >= this.minSensorPeriod ?
        cfg.sensorPeriod : this.minSensorPeriod;
    // blockTime needs to be long enough to complete processing for all (other) sensor
    // sets.  Otherwise, the later sets will never get processed until the first one(s)
    // stay in range.  This also interacts with the sensorPeriod, since a new correction
    // will only start when a new reading is taken.
    test.ok(isInteger(cfg.blockTime) && cfg.blockTime > val,
      'should have integer blockTime property with a value greater than the sensorPeriod');
    test.ok(isNonNegativeInteger(cfg.flowTime), 'should have non-negative integer flowTime property');
    test.ok(isNonNegativeInteger(cfg.dryLimit) && cfg.dryLimit <= this.maxAnalogValue,
      'should have integer dryLimit between 0 and ' + this.maxAnalogValue + ' (inclusive)');

    test.ok(isNonNegativeInteger(cfg.pumpWarmup), 'should have non-negative integer pumpWarmup property');
    test.ok(isNonNegativeInteger(cfg.pumpCooldown), 'should have non-negative integer pumpCooldown property');
    test.ok(isNonNegativeInteger(cfg.hardwareCycleTime),
      'should have non-negative integer hardwareCycleTime property');

    test.ok(Array.isArray(cfg.sensorPinSet) && cfg.sensorPinSet.length > 0,
      'should have a non-empty array sensorPinSet property');
    test.ok(isNonNullObject(cfg.pump), 'should have pump property object');
    // Check the array members and object properties in their own test cases

    test.done();
  },// ./function 'process configuration'(done)
  'pump configuration': function (test) {
    var properties, pin;
    if (!isNonNullObject(this.process.pump)) {
      test.done();
      return;
    }
    test.expect(3);

    // maximum for pump (and other) pin numbers varies by (actual) board used
    properties = Object.keys(this.process.pump);
    pin = properties[0] === undefined ? null : properties[0];
    test.strictEqual(properties.length, 1, 'pump object should have 1 property (the pin number)');
    test.ok(isNonNegativeInteger(pin), 'pump property must be a digital pin number');
    test.ok(isComponentId(this.process.pump[pin]), 'pump property value (id) must be a non-empty string');

    test.done();
  },// ./function 'pump configuration'(done)
  'sensor pin sets': function (test) {
    /* jshint maxcomplexity: 19, maxstatements: 50 */
    /* jshint maxcomplexity: 25, maxstatements: 50 */
    var pinSets, i, set, setIdx, allPins, allIds, obj, properties, usePin, useId, key;
    allPins = {};
    allIds = {};
    pinSets = Array.isArray(this.process.sensorPinSet) ? this.process.sensorPinSet : [];

    // Intialize the (unique) list of pin numbers and ids with the pump information
    obj = existingOrEmptyObject(this.process.pump);
    properties = Object.keys(obj);
    key = properties[0];
    if (key !== undefined) {
      allPins[key] = true;
      if (isComponentId(obj[key])) {
        allIds[obj[key]] = true;
      }
    }

    for (i = 0; i < pinSets.length; i += 1) {
      set = pinSets[i];
      test.ok(Array.isArray(set) && set.length === 2,
        'sensorPinSet ' + i + ' should be an array with 2 elements');
      if (Array.isArray(set) && set.length === 2) {
        // test array members
        test.ok(isNonNullObject(set[0]) && Object.keys(set[0]).length === 1,
          'first element of sensorSet ' + i + ' should be an object with a single (analog pin number) property');
        test.ok(isNonNullObject(set[1]) && Object.keys(set[1]).length === 1,
          'second element of sensorSet ' + i + ' should be an object with a single (digital pin number) property');

        for (setIdx = 0; setIdx < 2; setIdx += 1) {// 2 === set.length
          obj = set[setIdx];
          if (isNonNullObject(obj)) {
            properties = Object.keys(obj);
            usePin = true;
            useId = true;
            if (properties.length === 1) {
              key = properties[0];
              if (setIdx === 0) {
                test.ok(/^[AI]\d$/.test(key),
                  'Property name "' + key + '" should be an analog pin for sensor set ' + i);
                if (!/^[AI]\d$/.test(key)) { usePin = false; }
              } else {
                test.ok(isNonNegativeInteger(key),
                  'Property name "' + key + '" should be a digital pin for sensor set ' + i);
                if (!isNonNegativeInteger(key)) { usePin = false; }
              }
              test.ok(isComponentId(obj[key]),
                'property value should be non-empty string id for sensor set ' + i +
                (setIdx === 0 ? ' analog pin' : ' digital pin'));
              if (!isComponentId(obj[key])) { useId = false; }
              test.ok(!usePin || !allPins[key],
                'pin number ' + key + ' in set ' + i + ' has been used in a previous component');
              test.ok(!useId || !allIds[obj[key]],
                'id ' + obj[key] + ' in set ' + i + ' has been previously used, no duplicates allowed');
              /* jshint singleGroups: false */
              if (usePin && ((setIdx === 0 && /^[AI]\d$/.test(key)) ||
                  (setIdx === 1 && isNonNegativeInteger(key)))) {
                allPins[key] = true;
              }
              /* jshint singleGroups: true */
              if (useId && isComponentId(obj[key])) {
                allIds[obj[key]] = true;
              }
            }
          }
        }
      }
      // https://github.com/rwaldron/johnny-five/issues/793
      // https://github.com/rwaldron/io-plugins#minimum-plugin-class-requirements
      // https://github.com/achingbrain/board-io
      // test.doesNotThrow(function () { return five.Sensor({ pin: pinSet[i][0], type: 'analog' }); }, undefined,
    }

    test.done();
  },// ./function 'sensor pin sets'(done)
  'logging configuration': function (test) {
    var cfg;
    cfg = this.logging;
    test.expect(1 +
      (isNonNullObject(userinfo.logging) ? 1 : 0)
      );

    test.ok(isNonNullObject(userinfo.logging), 'userinfo should have a logging property object');
    if (!isNonNullObject(userinfo.logging)) {
      test.done();
      return;
    }

    test.ok(typeof cfg.configuration === 'string' && cfg.configuration.length > 0,
      'should have a configuration property that is a non-empty string');

    test.done();
  },// ./function 'logging configuration'(done)
  'datalogging module configuration': function (test) {
    // Without the module specific implementation specification, can only check to see if the base
    // module configuration properties exist
    var moduleRef, cfg;
    moduleRef = typeof this.logging.configuration === 'string' && this.logging.configuration.length > 0 ?
        this.logging.configuration : '';
    test.expect(//0 +
      (moduleRef === '' ? 0 : 1) +
        (isNonNullObject(userinfo[moduleRef]) ? 3 : 0)
    );

    if (moduleRef === '') {
      // No module configuration reference: nothing to test here
      test.done();
      return;
    }

    test.ok(isNonNullObject(userinfo[moduleRef]),
      'userinfo should have property matching the logging.configuration property value');
    if (!isNonNullObject(userinfo[moduleRef])) {
      // Configured datalogging property does not exist: nothing more to test here
      test.done();
      return;
    }

    cfg = userinfo[moduleRef];
    test.ok(typeof cfg.path === 'string' && cfg.path.length > 0,
      'should have a path property that is a non-empty string');
    test.ok(cfg.configuration !== undefined, 'should have a package specific configuration property');

    // Compensate for the different relative file path: needs to be smarter if the specified
    // module is found using the node path list.
    test.doesNotThrow(function () { require.resolve(path.resolve(cfg.path)); }, undefined,
      'The configured module "' + cfg.activeModule + '" should exist');

    test.done();
  }// ./function 'datalogging module configuration'(done)
};
