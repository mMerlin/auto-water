/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

var userConfig = require('../.private/userinfo.js');
var path = require('path');

function isDigitalPin(val) {
  return parseInt(val, 10) === parseFloat(val) && val >= 0;
  // can not find jslint options to suppress warning to wrap && subexpresion
  // wrapping gives jshint warning about unneeded grouping, which I *could* suppress
  // return typeof val === 'number' || typeof val === 'string' && Number(val).toString() === val;
  // if (typeof val === 'number' && val >= 0) {
  //   return true;
  // }
  // return typeof val === 'string' && Number(val).toString() === val && Number(val) >= 0;
}

// function hasDuplicate(arr) {
//   var idx, len, obj;
//   len = arr.length;
//   obj = {};
//   for (idx = 0; idx < len; idx += 1) {
//     if (obj[arr[idx]]) { return true; }
//     obj[arr[idx]] = true;
//   }
//   return false;
// }

function isComponentId(val) {
  return typeof val === 'string' && val.length > 0;
}

function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
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
    // setup here
    done();
  },
  'process': function (test) {
    /* jshint maxstatements: 40 */
    var cfg, obj, properties, pin;
    cfg = isNonNullObject(userConfig) && isNonNullObject(userConfig.process) ? userConfig.process : {};
    test.expect(24);

    test.ok(isNonNullObject(userConfig), 'user info should export an object');
    test.ok(isNonNullObject(userConfig.process), 'should have process property object');
    test.strictEqual(typeof cfg.sensorPeriod, 'number', 'should have numeric sensorPeriod property');
    test.strictEqual(typeof cfg.blockTime, 'number', 'should have numeric blockTime property');
    // blockTime needs to be long enough to complete processing for all (other) sensor
    // sets.  Otherwise, the later sets will never get processed until the first one(s)
    // stay in range.  This alwo interacts with the sensorPeriod, since a new correction
    // will only start when a new reading is taken.

    test.strictEqual(typeof cfg.dryLimit, 'number', 'should have numeric dryLimit property');
    test.strictEqual(typeof cfg.beginningOfTime, 'number',
      'should have numeric beginningOfTime property');

    // maximum for pump (and other) pin numbers varies by board used
    test.ok(isNonNullObject(cfg.pump), 'should have pump property object');
    obj = isNonNullObject(cfg.pump) ? cfg.pump : {};
    properties = Object.keys(obj);
    pin = properties[0] === undefined ? null : properties[0];
    test.strictEqual(properties.length, 1, 'pump object should have 1 property (the pin number)');
    test.ok(isDigitalPin(pin), 'pump property must be a digital pin number');
    test.ok(isComponentId(obj[pin]), 'pump property value (id) must be a non-empty string');

    // test.ok(isDigitalPin(cfg.pumpPin), 'pumpPin should be a digital pin number');
    // test.strictEqual(typeof cfg.pumpPin, 'number', 'should have numeric pumpPin property');
    test.strictEqual(typeof cfg.pumpWarmup, 'number', 'should have numeric pumpWarmup property');
    test.strictEqual(typeof cfg.pumpCooldown, 'number', 'should have numeric pumpCooldown property');
    test.strictEqual(typeof cfg.flowTime, 'number', 'should have numeric flowTime property');
    test.ok(Array.isArray(cfg.sensorPinSet), 'sensorPinSet property should be an array');
    test.ok(cfg.sensorPinSet.length > 0, 'at least one sensor set is needed');
    test.strictEqual(typeof cfg.hardwareCycleTime, 'number',
      'should have numeric hardwareCycleTime property');

    test.ok(cfg.sensorPeriod >= 10,
      'time between sensor reading should be greater than 10 milliseconds');
    test.ok(cfg.blockTime > cfg.sensorPeriod,
      'time between corrections should be greater sensorPeriod');
    test.ok(cfg.dryLimit >= 0 && cfg.dryLimit <= 1023,
      'sensor threshold mush be between 0 and 1023');
    test.ok(cfg.beginningOfTime < Date.now(), 'beginning of time must be in the past');
    test.ok(cfg.pumpWarmup >= 0, 'warmup time must not be negative');
    test.ok(cfg.pumpCooldown >= 0, 'cooldown time must not be negative');
    test.ok(cfg.flowTime > 0, 'correction flow time must be greater than zero');
    test.ok(cfg.hardwareCycleTime >= 0, 'hardware cycle time must not be negative');

    test.done();
  },
  'sensor pin sets': function (test) {
    /* jshint maxcomplexity: 19, maxstatements: 50 */
    var pinSets, i, set, allPins, allIds, obj, properties;
    allPins = {};
    allIds = {};
    pinSets = isNonNullObject(userConfig) && isNonNullObject(userConfig.process) &&
      Array.isArray(userConfig.process.sensorPinSet) ? userConfig.process.sensorPinSet : [];
    test.expect(pinSets.length * 14);

    // Intialize the (unique) list of pin numbers and ids with the pump information
    obj = isNonNullObject(userConfig) && isNonNullObject(userConfig.processs) &&
      isNonNullObject(userConfig.processs.pump) ? userConfig.processs.pump : {};
    properties = Object.keys(obj);
    if (properties[0] !== undefined) {
      allPins[properties[0]] = true;
    }
    if (properties[0] !== undefined && isComponentId(obj[properties[0]])) {
      allIds[obj[properties[0]]] = true;
    }

    for (i = 0; i < pinSets.length; i += 1) {
      test.ok(Array.isArray(pinSets[i]), 'each sensorPinSet element should be an array');
      set = Array.isArray(pinSets[i]) ? pinSets[i] : [];
      test.strictEqual(set.length, 2, 'each sensorPinSet should have 2 elements');
      test.ok(set.length > 0 && isNonNullObject(set[0]),
        'first element of sensorSet ' + i + 'should be a non-empty object');
      test.ok(set.length > 1 && isNonNullObject(set[1]),
        'second element of sensorSet ' + i + 'should be a non-empty object');

      obj = set.length > 0 && isNonNullObject(set[0]) ? set[0] : {};
      properties = Object.keys(obj);
      test.strictEqual(properties.length, 1, 'sensor spec for sensorSet ' + i + 'should have a single property');
      test.ok(!isNonNullObject(obj) || /^[AI]\d$/.test(properties[0]),
        properties[0] + ' should be an analog pin for sensor set ' + i);
      test.ok(!isNonNullObject(obj) || isComponentId(obj[properties[0]]),
        'property value should be non-empty string id for sensor set ' + i + ' analog pin');
      test.ok(!isNonNullObject(obj) || allPins[properties[0]] === undefined,
        'pin number ' + properties[0] + ' has been previously used');
      test.ok(!isNonNullObject(obj) || allIds[obj[properties[0]]] === undefined,
        'id ' + obj[properties[0]] + ' has been previously used, no duplicates allowed');
      if (isNonNullObject(obj)) {
        allPins[properties[0]] = true;
        allIds[obj[properties[0]]] = true;
      }

      obj = set.length > 1 && isNonNullObject(set[1]) ? set[1] : {};
      properties = Object.keys(obj);
      test.strictEqual(properties.length, 1, 'valve spec for sensorSet ' + i + 'should have a single property');
      test.ok(!isNonNullObject(obj) || isDigitalPin(properties[0]),
        properties[0] + ' should be a digital pin for sensor set ' + i);
      test.ok(!isNonNullObject(obj) || isComponentId(obj[properties[0]]),
        'property value should be non-empty string id for sensor set ' + i + ' digital pin');
      test.ok(!isNonNullObject(obj) || allPins[properties[0]] === undefined,
        'pin number ' + properties[0] + ' has been previously used');
      test.ok(!isNonNullObject(obj) || allIds[obj[properties[0]]] === undefined,
        'id ' + obj[properties[0]] + ' has been previously used, no duplicates allowed');
      if (isNonNullObject(obj)) {
        allPins[properties[0]] = true;
        allIds[obj[properties[0]]] = true;
      }

      // https://github.com/rwaldron/johnny-five/issues/793
      // https://github.com/rwaldron/io-plugins#minimum-plugin-class-requirements
      // https://github.com/achingbrain/board-io
      // test.doesNotThrow(function () { return five.Sensor({ pin: pinSet[i][0], type: 'analog' }); }, undefined,
    }

    test.done();
  },
  'data logging': function (test) {
    var cfg;
    cfg = isNonNullObject(userConfig) && isNonNullObject(userConfig.logging) ? userConfig.logging : {};
    test.expect(3);

    test.ok(!isNonNullObject(userConfig) || isNonNullObject(userConfig.logging),
      'should have logging property object');
    test.strictEqual(typeof cfg.activeModule, 'string', 'should have module string property');
    // Compensate for the different relative file path: needs to be smarter if the specified
    // module uses the node path list.
    test.doesNotThrow(function () { return require.resolve(path.resolve('.', cfg.activeModule)); }, undefined,
      'module should exist');

    test.done();
  },
  'logging module': function (test) {
    var logger = require(path.resolve('.', userConfig.logging.activeModule));
    test.expect(8);

    // Test that the specifed datalogging module provides the needed API, but
    // not the actual functionality.  Use a separate unit test file for each
    // known data logging package.
    test.strictEqual(typeof logger.init, 'function', 'datalogging module should provide an init method');
    test.strictEqual(typeof logger.addSensor, 'function', 'datalogging module should provide an addSensor method');
    test.strictEqual(typeof logger.addBoard, 'function', 'datalogging module should provide an addBoard method');
    test.strictEqual(typeof logger.finalize, 'function', 'datalogging module should provide a finalize method');
    test.strictEqual(logger.init.length, 1, 'datalogging init method should accept 1 argument');
    test.strictEqual(logger.addSensor.length, 1, 'datalogging addSensor method should accept 1 argument');
    test.strictEqual(logger.addBoard.length, 1, 'datalogging addBoard method should accept 1 argument');
    test.strictEqual(logger.finalize.length, 0, 'datalogging finalize method should accept 0 arguments');

    test.done();
  }
};
