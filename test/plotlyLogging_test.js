'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

var path = require('path');
var config = require('../.private/userinfo.js');
var datalog = require('../lib/plotlyLogging.js');

// Create the structure of nested objects, so can always just test if a
// property exists (!== undefined), without checking if the parent exists first
var CONST = {
  emptyTarget: {
    graphOptions: {}
  },
  emptyTrace: {
    x: [],
    y: [],
    line: {},
    stream: {},
    transform: {}
  },
  // Reused assert message templates
  optional: '{context} {path} property must be {type}, when it exists at all',
  required: '{context} requires {path} property as {type}, or have it in the template path',
  // Properties that need to be unique one way or other, so should never be
  // included in any level of a trace template object
  nonTraceTemplate: {
    line: {},
    component: true,
    stream: {
      token: true
    },
    transform: {},
    name: true
  },
  validationList: {
    fileopt: ['', 'extend', 'overwrite'],
    mode: ['', 'lines', 'markers', 'lines+markers'],
    type: ['', 'scatter'],
    shape: ['', 'linear', 'spline', 'vhv', 'hvh', 'vh', 'hv']
  }
};

// Boolean operation precedence test
/* jshint unused: false */
// function boolTest(a, b, c) {//, d
//   /* jshint singleGroups: false */
//   // return ((a && b) || (c && d)) === (a && b || c && d);//Tests as all valid
//   return ((a && b) || c) === (a && b || c);//Test as all valid
//   /* jshint singleGroups: true*/
//   // return a && (b || c ) === (a && b || c);//not all true, and no singleGroup warning
// }
//   /* jshint unused: true */
// console.log(boolTest(false, false, false, false));
// console.log(boolTest(true, false, false, false));
// console.log(boolTest(false, true, false, false));
// console.log(boolTest(true, true, false, false));
// console.log(boolTest(false, false, true, false));
// console.log(boolTest(true, false, true, false));
// console.log(boolTest(false, true, true, false));
// console.log(boolTest(true, true, true, false));
// console.log(boolTest(false, false, false, true));
// console.log(boolTest(true, false, false, true));
// console.log(boolTest(false, true, false, true));
// console.log(boolTest(true, true, false, true));
// console.log(boolTest(false, false, true, true));
// console.log(boolTest(true, false, true, true));
// console.log(boolTest(false, true, true, true));
// console.log(boolTest(true, true, true, true));

// Add a function to the Array prototype, if it does not already exist
if (!Array.prototype.includes) {
  /* jshint freeze: false */
  /**
   * Check if a value is an element of the current array
   *
   * @param {object} val        exact object/primative datatype to look for
   * @return {boolean}
   */
  Array.prototype.includes = function (val) {
    var i;
    for (i = 0; i < this.length; i += 1) {
      if (this[i] === val) { return true; }
    }
    return false;
  };// ./function Array.prototype.includes(val)
  /* jshint freeze: true */
}// ./if (!Array.prototype.includes)

/**
 * Check if the passed argument is a 'normal' object (not null or an Array)
 *
 * @param {object} obj          variable to check
 * @return {boolean}
 */
function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Check if the passed argument is either a non-empty string, or undefined
 *
 * @param {object} s            variable to check
 * @return {boolean}
 */
function isOptionalString(s) {
  /* jshint singleGroups: false */
  return s === undefined || (typeof s === 'string' && s.length > 0);
}

/**
 * return the passed argument, or an empty object, if the pass argument is not
 * a 'normal' object
 *
 * @param {object} object       variable to check (and return)
 * @return {object}
 */
function existingOrEmptyObject(obj) {
  return isNonNullObject(obj) ? obj : {};
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
}// ./function collectProcessIds(obj)

/**
 * Check if the specified module name is currently active in the configuration
 *
 * @param {string} moduleName   datalogging package name
 * @return {boolean}
 */
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
}// ./function isLoggingModuleActive(moduleName)

// currently using JSON.parse(JSON.stringify(obj)) as simple deep copy for standard objects
// deepCopyStandardObject = function (obj) {
//   /* jshint validthis: true */
//   /* jshint maxcomplexity: 10 */
//   var copy, key;
//   if (obj === null || obj === undefined || typeof obj === 'number' ||
//       typeof obj === 'string') {
//     return obj;// Just return primitive datatypes
//   }
//   if (Array.isArray(obj)) {
//     copy = [];
//     for (key = 0; key < obj.len; key += 1) {
//       copy[key] = deepCopyStandardObject(obj[key]);// deep copy array elements
//     }
//     return copy;
//   }
//   if (typeof obj !== 'object') {
//     throw new Error('Can not deep copy ' + typeof obj + ' properties');
//   }
//   copy = {};
//   for (key in obj) {
//     if (obj.hasOwnProperty(key)) {
//       copy[key] = deepCopyStandardObject(obj[key]);// deep copy object properties
//     }
//   }
//   return copy;
// };// ./deepCopyStandardObject = function (obj)

/**
 * Recursively extend the destination object with (non conflicting) properties from
 * the source object
 *
 * @param {object} src          object to copy properties from
 * @param {object} dest         object to extend with src object properties
 * @return {undefined}
 */
function walkAndCopyMissing(src, dest) {
  var p;// Current property
  for (p in src) {
    if (src.hasOwnProperty(p)) {
      if (dest[p] === undefined) {
        // propery p does not exist in destination, deep copy from source
        // dest[p] = deepCopyStandardObject(src[p]);
        dest[p] = JSON.parse(JSON.stringify(src[p]));
      } else if (isNonNullObject(src[p]) && isNonNullObject(dest[p])) {
        // source and destination properties are both non-null objects,
        // recursively walk the property trees
        walkAndCopyMissing(src[p], dest[p]);
      }
    }
  }
}// ./function walkAndCopyMissing(src, dest)

/**
 * Extend a (deep) copy of an object with the properties of the base object
 *
 * @param {object} obj          object to clone and extend
 * @param {object} base         object to copy properties from
 * @return {object}
 */
function cascadeTemplate(obj, base) {
  var cascade;
  cascade = JSON.parse(JSON.stringify(obj));
  walkAndCopyMissing(base, cascade);
  return cascade;
}// ./function cascadeTemplate(obj, base)

/**
 * Perform assert tests to check if any properties of the passed bad object exist in
 * the passed obj.
 *
 * @param {object} bad          Object with nested properties that should not exist in obj
 * @param {object} obj          Object to check for bad properties
 * @param {object} test         Node unit test object
 * @param {string} context      Prefix text to use for failing assert messages
 * @return {undefined}
 */
function detectBadProperties(bad, obj, test, context) {
  var p;
  for (p in bad) {
    if (bad.hasOwnProperty(p)) {
      if (typeof bad[p] !== 'object') {//=== boolean | !== 'object'
        test.strictEqual(obj[p], undefined, context + 'property ' + p + ' should never be in a template');
      } else {
        if (isNonNullObject(obj[p])) {
          detectBadProperties(bad[p], obj[p], test, context);
        }// else error, but validateTemplateProperties will report the problem
      }
    }
  }
}// ./function detectBadProperties(bad, obj, test, context)

/**
 * Run assertion tests for the (nested) properties of a target template object
 *
 * @param {object} template     target template object to check
 * @param {object} test         Node unit test object
 * @param {string} context      Prefix text to use for failing assert messages
 * @return {undefined}
 */
function validateTargetTemplate(template, test, context) {
  var obj;
  test.ok(isOptionalString(template.userName),
    CONST.optional.supplant({ context: context, path: 'userName', type: 'non-empty string' }));

  // Not practical to validate much of the graphOptions object structure.  Plotly will
  // have to do that, and fail with whatever information their api provides.  Much of it is
  // optional anyway.
  test.ok(isNonNullObject(template.graphOptions),
    CONST.optional.supplant({ context: context, path: 'graphOptions', type: 'an object' }));
  obj = existingOrEmptyObject(template.graphOptions);
  test.ok(isOptionalString(obj.filename),
    CONST.optional.supplant({ context: context, path: 'graphOptions.filename', type: 'a non-empty string' }));
  /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
  test.ok(obj.fileopt === undefined || (typeof obj.fileopt === 'string' &&
    CONST.validationList.fileopt.includes(obj.fileopt)),
    CONST.optional.supplant({ context: context, path: 'graphOptions.fileopt', type: 'a string from known values' }));
  /* jshint singleGroups: true */
}// ./function validateTargetTemplate(template, test, context)

/**
 * Run assertion tests for the (nested) properties of a trace template object
 *
 * @param {object} template     trace template object to check
 * @param {object} test         Node unit test object
 * @param {string} context      Prefix text to use for failing assert messages
 * @return {undefined}
 */
function validateTraceTemplate(template, test, context) {
  var obj, lvl2;
  test.ok(isNonNullObject(template),
    CONST.optional.supplant({ context: context, path: 'trace', type: 'an object' }));
  obj = isNonNullObject(template) ? template : JSON.parse(JSON.stringify(CONST.emptyTrace));
  //IDEA: line and line.shape are required IIF mode includes 'lines'
  test.ok(isNonNullObject(obj.line),
    CONST.optional.supplant({ context: context, path: 'line', type: 'an object' }));
  test.ok(isNonNullObject(obj.stream),
    CONST.optional.supplant({ context: context, path: 'stream', type: 'an object' }));
  /* jshint singleGroups: false */
  test.ok(obj.x === undefined || (Array.isArray(obj.x) && obj.x.length === 0),
    CONST.optional.supplant({ context: context, path: 'x', type: 'an empty array' }));
  test.ok(obj.y === undefined || (Array.isArray(obj.y) && obj.y.length === 0),
    CONST.optional.supplant({ context: context, path: 'y', type: 'an empty array' }));
  test.ok(obj.mode === undefined || (typeof obj.mode === 'string' && CONST.validationList.mode.includes(obj.mode)),
    CONST.optional.supplant({ context: context, path: 'mode', type: 'a string from known values' }));
  test.ok(obj.type === undefined || (typeof obj.type === 'string' && CONST.validationList.type.includes(obj.type)),
    CONST.optional.supplant({ context: context, path: 'type', type: 'a string from known values' }));
  //IDEA: line and line.shape are required IIF mode includes 'lines'
  lvl2 = existingOrEmptyObject(obj.line);
  test.ok(lvl2.shape === undefined || (typeof lvl2.shape === 'string' &&
    CONST.validationList.shape.includes(lvl2.shape)),
    CONST.optional.supplant({ context: context, path: 'line.shape', type: 'a string from known values' }));
  lvl2 = existingOrEmptyObject(obj.stream);
  test.ok(lvl2.maxPoints === undefined || (parseInt(lvl2.maxPoints, 10) === parseFloat(lvl2.maxPoints) &&
    lvl2.maxPoints > 1),
    CONST.optional.supplant({ context: context, path: 'stream.maxPoints', type: 'a postive Integer' }));
  /*jshint singleGroups: true */
  test.strictEqual(lvl2.token, undefined,
    context + ' stream should not have a token property');

}// ./function validateTraceTemplate(template, test, context)

function validateTransformProperties(transform, test, context) {
  test.ok(transform[true] === undefined || typeof transform[true] === 'number',
    CONST.optional.supplant({ context: context, path: '[true]', type: 'a number' }));
  test.ok(transform[false] === undefined || typeof transform[false] === 'number',
    CONST.optional.supplant({ context: context, path: '[false]', type: 'a number' }));
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
    /* jshint maxcomplexity: 15 */
    var cfg, ary, set, acct, i, j;
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

    this.moduleIsActive = isLoggingModuleActive('plotlyLogging');
    // Create defaults for missing or bad properties, to reduce the number of duplications in compound test conditions
    this.cfg = isNonNullObject(config) && isNonNullObject(config.logging) ? config.logging.plotlyLogging : undefined;
    this.base = existingOrEmptyObject(this.cfg);
    this.authentication = Array.isArray(this.base.authentication) ? this.base.authentication : [];
    this.target = cascadeTemplate(existingOrEmptyObject(this.base.target), CONST.emptyTarget);
    this.trace = cascadeTemplate(existingOrEmptyObject(this.base.trace), CONST.emptyTrace);
    this.plots = Array.isArray(this.base.plots) ? this.base.plots : [];

    this.allAccounts = {};
    for (i = 0; i < this.authentication.length; i += 1) {
      acct = isNonNullObject(this.authentication[i]) ? this.authentication[i] : {};
      if (typeof acct.userName === 'string' && acct.userName.length > 0) {
        // Valid looking account user name
        this.allAccounts[acct.userName] = {
          available: 0,// Available token count
          files: {}
        };
      }
      ary = Array.isArray(acct.tokens) ? acct.tokens : [];
      for (j = 0; j < ary.length; j += 1) {
        if (typeof ary[i] === 'string' && /^[a-z0-9]{10}$/.test(ary[i])) {
          this.allAccounts[acct.userName].available += 1;// Found a valid looking token
        }
      }
    }

    done();
  },// ./function setup(done)
  /**
   * check for the correct data logging api methods
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
  'property types': function (test) {
    test.expect(8);

    test.strictEqual(typeof datalog.init, 'function', 'should provide an init method');
    test.strictEqual(typeof datalog.addSensor, 'function', 'should provide an addSensor method');
    test.strictEqual(typeof datalog.addBoard, 'function', 'should provide an addBoard method');
    test.strictEqual(typeof datalog.finalize, 'function', 'should provide a finalize method');
    test.strictEqual(datalog.init.length, 2, '2 arguments should be passed to init');
    test.strictEqual(datalog.addSensor.length, 1, 'single argument should be passed to addSensor');
    test.strictEqual(datalog.addBoard.length, 1, 'single argument should be passed to addBoard');
    test.strictEqual(datalog.finalize.length, 0, 'no arguments should be passed to finalize');

    test.done();
  },// ./function 'property types'(test)
  /**
   * Check the (nested) properties of a plotlyLogging configuration object,
   * excluding the main and plot template object properties
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
  'plotly configuration': function (test) {
    /* jshint maxcomplexity: 16 */
    var testCount, i, plot, obj, context, realuser, realfile;

    // Calculation of the expected number of assert is a bit more complex than usual, since the base
    // plotly configuration is an array that can have varying numbers of plot/graph configurations,
    // each of which can have varying numbers of traces.
    testCount = 2 + (isNonNullObject(this.cfg) ? 1 : 0);// base + plots array check
    for (i = 0; i < this.plots.length; i += 1) {
      testCount += 1 + (isNonNullObject(this.plots[i]) ? 7 : 0);// plot object and plot properties (to trace)
    }
    test.expect(testCount);

    test.ok(this.cfg === undefined || isNonNullObject(this.cfg),
      'plotlyLogging must be a (non-empty) array property, when it exists at all');
    test.ok(isNonNullObject(this.cfg) || !this.moduleIsActive,
      'A logging.plotlyLogging object property is required when plotlyLogging is an active module');

    if (testCount <= 2) {
      test.done();
      return;
    }

    test.ok(Array.isArray(this.cfg.plots) && this.plots.length > 0,
      'plotlyLogging requires a plots array property with at least 1 entry');
    for (i = 0; i < this.plots.length; i += 1) {
      context = 'Plot ' + i;
      test.ok(isNonNullObject(this.plots[i]), context + ' configuration must be an object');
      if (isNonNullObject(this.plots[i])) {
        plot = this.plots[i];
        test.ok(plot.target === undefined || isNonNullObject(plot.target),
          context + ' target property must be an object, when it exists at all');
        // plot.trace checke as part of the template validation
        test.ok(Array.isArray(plot.plotData) && plot.plotData.length > 0,
          context + ' requires a plotData property as a non-empty Array');

        // Validate the properties of the plot target object
        obj = existingOrEmptyObject(plot.target);
        context = 'Plot ' + i + ' target';
        test.ok(obj.graphOptions === undefined || isNonNullObject(obj.graphOptions),
          context + ' graphOptions property must be an object, or undefined');
        /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
        test.ok((obj.userName === undefined && this.target.userName) ||
          (typeof obj.userName === 'string' && obj.userName.length > 0 && this.allAccounts[obj.userName]),
          CONST.required.supplant({context: context, path: 'a userName', type: 'a string from authentication values'}));
        realuser = (typeof obj.userName === 'string' && obj.userName.length > 0 && this.allAccounts[obj.userName]) ?
            obj.userName : this.target.userName;

        obj = existingOrEmptyObject(obj.graphOptions);// sub object properties
        test.ok((obj.filename === undefined && this.target.graphOptions.filename) ||
          (typeof obj.filename === 'string' && obj.filename.length > 0),
          CONST.required.supplant({context: context, path: 'a graphOptions.filename', type: 'a non-empty string'}));
        realfile = typeof obj.filename === 'string' && obj.filename.length > 0 ?
            obj.filename : this.target.graphOptions.filename;
        test.ok(realfile && this.allAccounts[realuser].files[realfile] === undefined,
          context + ' File "' + realfile + '" used for a previous plot for user "' + realuser + '"');
        test.ok((obj.fileopt === undefined && this.target.graphOptions.fileopt) ||
          (typeof obj.fileopt === 'string' && CONST.validationList.fileopt.includes(obj.fileopt)),
          CONST.required.supplant({context: context, path: 'a graphOptions.fileopt',
            type: 'a string from known values'}));
        /* jshint singleGroups: true */
      }// ./if (isNonNullObject(this.plots[i]))
    }// ./for (i = 0; i < this.plots.length; i += 1)

    test.done();
  },// ./function 'plotly configuration'(test)
  'plotly traces': function (test) {
    /* jshint maxcomplexity: 17 */
    var testCount, plot, traces, cascadeData, plotComponents, i, j, realuser, context, obj, lvl2;

    testCount = 0;
    for (i = 0; i < this.plots.length; i += 1) {
      plot = existingOrEmptyObject(this.plots[i]);
      traces = Array.isArray(plot.plotData) ? plot.plotData : [];
      testCount += traces.length * 12;// trace (and nested) properties
    }
    test.expect(testCount);

    // validate the properties (with defaults from cascadeData) for each of the
    // traces (streams) configured for each of the plots
    for (i = 0; i < this.plots.length; i += 1) {
      plot = isNonNullObject(this.plots[i]) ? this.plots[i] : {};
      cascadeData = cascadeTemplate(existingOrEmptyObject(plot.trace), this.trace);
      obj = existingOrEmptyObject(plot.target);
      realuser = typeof obj.userName === 'string' && obj.userName.length > 0 && this.allAccounts[obj.userName] ?
          obj.userName : this.target.userName;
      plotComponents = {};// Track duplicate component references within a single plot
      traces = Array.isArray(plot.plotData) ? plot.plotData : [];
      for (j = 0; j < traces.length; j += 1) {
        context = 'Plot ' + i + ', trace ' + j;
        test.ok(isNonNullObject(traces[j]),
          context + 'configuration must be an object');
        obj = existingOrEmptyObject(traces[j]);
        test.ok(obj.line === undefined || isNonNullObject(obj.line),
          CONST.optional.supplant({ context: context, path: 'line', type: 'an object' }));
        test.ok(obj.stream === undefined || isNonNullObject(obj.stream),
          CONST.optional.supplant({ context: context, path: 'stream', type: 'an object' }));
        test.ok(typeof obj.component === 'string' && this.eventSource[obj.component] &&
          !plotComponents[obj.component], context +
          ' requires component property as a string matching a unique configured id from the process object');
        if (typeof obj.component === 'string' && this.eventSource[obj.component]) {
          plotComponents[obj.component] = true;// Save referenced component id
        }

        /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
        test.ok((obj.x === undefined && cascadeData.x) || (Array.isArray(obj.x) && obj.x.length === 0),
          CONST.required.supplant({context: context, path: 'x', type: 'an empty array'}));
        test.ok((obj.y === undefined && cascadeData.y) || (Array.isArray(obj.y) && obj.y.length === 0),
          CONST.required.supplant({context: context, path: 'y', type: 'an empty array'}));
        test.ok((obj.mode === undefined  && cascadeData.mode) ||
          (typeof obj.mode === 'string' && CONST.validationList.mode.includes(obj.mode)),
          CONST.required.supplant({context: context, path: 'mode', type: 'a string from the known values'}));
        test.ok((obj.type === undefined  && cascadeData.type) ||
          (typeof obj.type === 'string' && CONST.validationList.type.includes(obj.type)),
          CONST.required.supplant({context: context, path: 'type', type: 'a string from the known values'}));

        lvl2 = existingOrEmptyObject(obj.line);
        test.ok((lvl2.shape === undefined  && cascadeData.line.shape) ||
          (typeof lvl2.shape === 'string' && CONST.validationList.shape.includes(lvl2.shape)),
          CONST.required.supplant({ context: context, path: 'line.shape', type: 'a string from the known values' }));
        /* jshint singleGroups: true */

        lvl2 = existingOrEmptyObject(obj.stream);
        test.ok(lvl2.maxPoints === undefined || parseInt(lvl2.maxPoints, 10) === parseFloat(lvl2.maxPoints),
          CONST.optional.supplant({ context: context, path: 'stream.maxPoints', type: 'a positive integer' }));
        test.strictEqual(lvl2.token, undefined,
          context + ' stream should not have a token property');
        this.allAccounts[realuser].available -= 1;
        test.ok(realuser && this.allAccounts[realuser].available >= 0,
          context + ' user "' + realuser + '" does not have enough tokens to add another trace');
      }// ./for (j = 0; j < traces.length; j += 1)
    }

    test.done();
  },// ./function 'plotly traces'(test)
  /**
   * Check the properites of the optional transform objects
   *
   * transform objects can exist in trace templates, or in any plot configuration
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
  'plotly data transform': function (test) {
    /* jshint maxcomplexity: 12 */
    var testCount, plot, traces, i, j, context, obj;

    testCount = 3;
    for (i = 0; i < this.plots.length; i += 1) {
      plot = existingOrEmptyObject(this.plots[i]);
      traces = Array.isArray(plot.plotData) ? plot.plotData : [];
      testCount += 3 * (traces.length + 1);// trace (and nested) properties
    }
    test.expect(testCount);

    context = 'Main trace template';
    test.ok(this.trace.transform === undefined || isNonNullObject(this.trace.transform),
      CONST.optional.supplant({ context: context, path: 'transform', type: 'an object' }));

    validateTransformProperties(isNonNullObject(this.trace.transform) ? this.trace.transform : {}, test, context);
    for (i = 0; i < this.plots.length; i += 1) {
      plot = existingOrEmptyObject(this.plots[i]);
      obj = existingOrEmptyObject(plot.trace);
      context = 'Plot ' + i + ' trace template';
      test.ok(obj.transform === undefined || isNonNullObject(obj.transform),
        CONST.optional.supplant({ context: context, path: 'transform', type: 'an object' }));
      validateTransformProperties(isNonNullObject(obj.transform) ? obj.transform : {}, test, context);
      traces = Array.isArray(plot.plotData) ? plot.plotData : [];
      for (j = 0; j < traces.length; j += 1) {
        obj = existingOrEmptyObject(traces[j]);
        context = 'Plot ' + i + ', trace ' + j;
        test.ok(obj.transform === undefined || isNonNullObject(obj.transform),
          CONST.optional.supplant({ context: context, path: 'transform', type: 'an object' }));
        validateTransformProperties(isNonNullObject(obj.transform) ? obj.transform : {}, test, context);
      }
    }

    test.done();
  },// ./function 'plotly data transform'(test)
  /**
   * Check the properites of the requied authentiation object
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
  'plotly authentication': function (test) {
    /* jshint maxcomplexity: 12, maxstatements: 36 */
    var testCount, accumTokens, accumAccts, accumApiKeys,
      i, j, context, obj, ary;

    if (!isNonNullObject(this.cfg)) {
      test.expect(0);
      test.done();
      return;
    }

    testCount = 1;
    for (i = 0; i < this.authentication.length; i += 1) {
      testCount += 1;
      if (isNonNullObject(this.authentication[i])) {
        testCount += 3;
        obj = existingOrEmptyObject(this.authentication[i]);
        if (Array.isArray(obj.tokens)) {
          testCount += obj.tokens.length;
        }
      }
    }
    test.expect(testCount);

    // Record and check for duplicate tokens, keys, usernames across all accounts
    accumTokens = {};
    accumAccts = {};
    accumApiKeys = {};

    test.ok(Array.isArray(this.cfg.authentication) && this.authentication.length > 0,
      'plotlyLogging property requires an authentication array with at least 1 entry');
    for (i = 0; i < this.authentication.length; i += 1) {
      context = 'Authentication account ' + i;
      test.ok(isNonNullObject(this.authentication[i]), context + ' configuration must be an object');
      if (isNonNullObject(this.authentication[i])) {
        obj = this.authentication[i];
        test.ok(typeof obj.userName === 'string' && obj.userName.length > 0 && !accumAccts[obj.userName],
          context + ' requires a unique userName property as a non-empty string');
        if (typeof obj.userName === 'string' && obj.userName.length > 0) {
          accumAccts[obj.userName] = true;
        }
        test.ok(typeof obj.apiKey === 'string' && /^[a-z0-9]{10}$/.test(obj.apiKey) && !accumApiKeys[obj.apiKey],
          context + ' requires a unique userApi property as a a string of 10 lowercase alphanumeric characters');
        if (typeof obj.apiKey === 'string' && /^[a-z0-9]{10}$/.test(obj.apiKey)) {
          accumApiKeys[obj.apiKey] = true;
        }
        test.ok(Array.isArray(obj.tokens) && obj.tokens.length > 0,
          context + ' requires a tokens array with at least 1 entry');

        ary = Array.isArray(obj.tokens) ? obj.tokens : [];
        for (j = 0; j < ary.length; j += 1) {
          test.ok(typeof ary[j] === 'string' && /^[a-z0-9]{10}$/.test(ary[j]) && !accumTokens[ary[j]],
            context + ', token ' + j + ' must be a unique string of 10 lowercase letters and numbers');
          if (typeof ary[j] === 'string' && /^[a-z0-9]{10}$/.test(ary[j])) {
            accumTokens[ary[j]] = true;
          }
        }
      }
    }

    test.done();
  },// ./function 'plotly authentication'(test)
  /**
   * Check the (nested) properties of a plotlyLogging trace template object
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
  'plotly templates': function (test) {
    var template, i, context;

    test.expect(5 + (this.plots.length + 1) * 14);

    // Verify the target template object and properties
    context = 'Target template';
    test.ok(this.base.target === undefined || isNonNullObject(this.base.target),
      context + ' must be an object, when it exists at all');
    template = cascadeTemplate(existingOrEmptyObject(this.target), CONST.emptyTarget);
    validateTargetTemplate(template, test, context);// 4 asserts

    // Verify the main/outedetectBadPropertiesr trace template object and properties
    context = 'Main trace template';
    test.ok(this.base.trace === undefined || isNonNullObject(this.base.trace),
      context + ' must be an object, when it exists at all');
    template = cascadeTemplate(existingOrEmptyObject(this.trace), CONST.emptyTrace);
    // Check for properties that should never existing in a trace template
    // The function performs a number of assertions equal to the number of non-object
    // properties (nested) in the nonTraceTemplate object (currently 3)
    detectBadProperties(CONST.nonTraceTemplate, template, test, context);
    // Verify the datatype (and where possible contents) of all known template properties
    validateTraceTemplate(template, test, context);// 10 asserts

    // Repeat above checks for the trace template in each plot configuration
    for (i = 0; i < this.plots.length; i += 1) {
      context = 'plot ' + i + ' trace template';
      test.ok(this.plots[i].trace === undefined || isNonNullObject(this.plots[i].trace),
        context + ' must be an object, when it exists at all');
      template = cascadeTemplate(existingOrEmptyObject(this.plots[i].trace), CONST.emptyTrace);
      detectBadProperties(CONST.nonTraceTemplate, template, test, context);// 3 aserts
      validateTraceTemplate(template, test, context);// 10 asserts
    }

    test.done();
  }// ./function 'plotly templates templates'(test)
};

exports['call sequence validation'] = {
  setUp: function (done) {
    // setup here
    done();
  },// ./function setup(done)
  /**
   * Check that the datalogging api detects out of sequence method calls
   *
   * @param {object} test       node-unit test object
   * @return {undefined}
   */
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
  }// ./function 'no init'(test)
};
