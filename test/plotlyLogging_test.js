'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

var OPTIONAL_TYPE = '{context}template {path} property must be {type}, when it exists at all';
var REQUIRED_TYPE = '{context}requires {path} property as {type}, or have it in the template path';
var path = require('path');
var config = require('../.private/userinfo.js');
var datalog = require('../lib/plotlyLogging.js');
var CONST = {};
CONST.emptyTemplate = {
  graphOptions: {},
  trace: {
    line: {},
    stream: {},
    transform: {}
  }
};// Create the structure of nested objects, so can always just test if a
// property exists (!== undefined), without checking if the parent exists first
CONST.nonTemplate = {
  graphOptions: {},
  trace: {
    line: {},
    stream: {
      component: true,
      token: true
    },
    transform: {},
    name: true
  }
};// Properties that need to be unique one way or other, so should never be
CONST.validationList = {
  fileopt: ['', 'extend', 'overwrite'],
  mode: ['', 'lines', 'markers', 'lines+markers'],
  type: ['', 'scatter'],
  shape: ['', 'linear', 'spline', 'vhv', 'hvh', 'vh', 'hv']
};
// included in any level of template
var debug = {};//DEBUG
// console.log(Object.keys(CONST.emptyTemplate), Object.keys(CONST.nonTemplate));
console.log(typeof debug, '**************');
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

if (!Array.prototype.includes) {
  /* jshint freeze: false */
  var i;
  Array.prototype.includes = function (val) {
    for (i = 0; i < this.length; i += 1) {
      if (this[i] === val) { return true; }
    }
    return false;
  };
  /* jshint freeze: true */
}

function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

// is optional, but can not be an empty string
function isOptionalString(s) {
  /* jshint singleGroups: false */
  return s === undefined || (typeof s === 'string' && s.length > 0);
}

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
// };

function walkAndCopyMissing(src, dest) {
  var p;
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
}

function cascadeTemplate(obj, base) {
  var cascade;
  cascade = JSON.parse(JSON.stringify(obj));
  walkAndCopyMissing(base, cascade);
  return cascade;
}

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
}

function validateTemplateProperties(template, test, context) {
  /* jshint maxcomplexity: 10 */
  var obj, lvl2;

  test.ok(isOptionalString(template.userName),
    OPTIONAL_TYPE.supplant({ context: context, path: 'userName', type: 'non-empty string' }));
  /* jshint singleGroups: false */
  test.ok(template.apiKey === undefined || (typeof template.apiKey === 'string' &&
    /^[a-z0-9]{10}$/.test(template.apiKey)),
    OPTIONAL_TYPE.supplant({ context: context, path: 'apiKey',
      type: 'a string of 10 lowercase alphanumeric characters' }));
  /* jshint singleGroups: true */
  // Not practical to validate much of the graphOptions object structure.  Plotly will
  // have to do that, and fail with whatever information their api provides.  Much of it is
  // optional anyway.
  test.ok(isNonNullObject(template.graphOptions),
    OPTIONAL_TYPE.supplant({ context: context, path: 'graphOptions', type: 'an object' }));
  obj = existingOrEmptyObject(template.graphOptions);
  test.ok(isOptionalString(obj.filename),
    OPTIONAL_TYPE.supplant({ context: context, path: 'graphOptions.filename', type: 'a non-empty string' }));
  /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
  test.ok(obj.fileopt === undefined || (typeof obj.fileopt === 'string' &&
    CONST.validationList.fileopt.includes(obj.fileopt)),
    OPTIONAL_TYPE.supplant({ context: context, path: 'graphOptions.fileopt', type: 'a string from known values' }));
  /* jshint singleGroups: true */

  test.ok(isNonNullObject(template.trace),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace', type: 'an object' }));
  obj = isNonNullObject(template.trace) ? template.trace : JSON.parse(JSON.stringify(CONST.emptyTemplate.trace));
  test.ok(isNonNullObject(obj.line),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.line', type: 'an object' }));
  test.ok(isNonNullObject(obj.stream),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.stream', type: 'an object' }));
  test.ok(isNonNullObject(obj.transform),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.transform', type: 'an object' }));
  /* jshint singleGroups: false */
  test.ok(obj.x === undefined || (Array.isArray(obj.x) && obj.x.length === 0),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.x', type: 'an empty array' }));
  test.ok(obj.y === undefined || (Array.isArray(obj.y) && obj.y.length === 0),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.y', type: 'an empty array' }));
  test.ok(obj.mode === undefined || (typeof obj.mode === 'string' && CONST.validationList.mode.includes(obj.mode)),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.mode', type: 'a string from known values' }));
  test.ok(obj.type === undefined || (typeof obj.type === 'string' && CONST.validationList.type.includes(obj.type)),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.type', type: 'a string from known values' }));
  lvl2 = existingOrEmptyObject(obj.line);
  test.ok(lvl2.shape === undefined || (typeof lvl2.shape === 'string' &&
    CONST.validationList.shape.includes(lvl2.shape)),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.line.shape', type: 'a string from known values' }));
  lvl2 = existingOrEmptyObject(obj.stream);
  test.ok(lvl2.maxPoints === undefined || (parseInt(lvl2.maxPoints, 10) === parseFloat(lvl2.maxPoints) &&
    lvl2.maxPoints > 1),
    OPTIONAL_TYPE.supplant({ context: context, path: 'trace.stream.maxPoints', type: 'a postive Integer' }));
  /*jshint singleGroups: true */

  //TODO: define transform properties / structure
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
    /* jshint maxcomplexity: 10 */
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

    // Create defaults for missing or bad properties, to reduce the number of duplications in compound test conditions
    this.moduleIsActive = isLoggingModuleActive('plotlyLogging');
    this.cfg = isNonNullObject(config) && isNonNullObject(config.logging) ? config.logging.plotlyLogging : undefined;
    this.base = existingOrEmptyObject(this.cfg);
    this.template = cascadeTemplate(existingOrEmptyObject(this.base.template), CONST.emptyTemplate);
    this.plots = Array.isArray(this.base.plots) ? this.base.plots : [];

    done();
  },
  'property types': function (test) {
    test.expect(8);

    test.strictEqual(typeof datalog.init, 'function', 'should provide an init method');
    test.strictEqual(typeof datalog.addSensor, 'function', 'should provide an addSensor method');
    test.strictEqual(typeof datalog.addBoard, 'function', 'should provide an addBoard method');
    test.strictEqual(typeof datalog.finalize, 'function', 'should provide a finalize method');
    test.strictEqual(datalog.init.length, 1, 'single argument should be passed to init');
    test.strictEqual(datalog.addSensor.length, 1, 'single argument should be passed to addSensor');
    test.strictEqual(datalog.addBoard.length, 1, 'single argument should be passed to addBoard');
    test.strictEqual(datalog.finalize.length, 0, 'no arguments should be passed to finalize');

    test.done();
  },
  'plotly configuration': function (test) {
    /* jshint maxcomplexity: 99, maxstatements: 99 */
    var testCount, i, j, plot, obj, traces, cascadeData, context;

    // Calculation of the expected number of assert is a bit more complex than usual, since the base
    // plotly configuration is an array that can have varying numbers of plot/graph configurations,
    // each of which can have varying numbers of traces.
    testCount = 2 + (isNonNullObject(this.cfg) ? 1 : 0);//base2 + /key1
    for (i = 0; i < this.plots.length; i += 1) {
      testCount += 1 + (isNonNullObject(this.plots[i]) ? 7 : 0);//plotfix1 + plotif7
      plot = existingOrEmptyObject(this.plots[i]);
      traces = Array.isArray(plot.plotData) ? plot.plotData : [];
      testCount += traces.length * 6;//trace6
    }
    test.expect(testCount);

    test.ok(this.cfg === undefined || isNonNullObject(this.cfg),
      'plotlyLogging must be a (non-empty) array property, when it exists at all');//base1
    test.ok(isNonNullObject(this.cfg) || !this.moduleIsActive,
      'A logging.plotlyLogging array property is required when plotlyLogging is an active module');//base2

    if (testCount <= 2) {
      test.done();
      return;
    }

    test.ok(Array.isArray(this.cfg.plots) && this.plots.length > 0,
      'plotlyLogging property requires a plots array with at least 1 entry');//key1
    for (i = 0; i < this.plots.length; i += 1) {
      context = 'Plot ' + i + ' ';
      test.ok(isNonNullObject(this.plots[i]), context + 'configuration must be an object');//plotfix1
      if (isNonNullObject(this.plots[i])) {
        plot = this.plots[i];
        test.ok(plot.template === undefined || isNonNullObject(plot.template),
          context + 'template property must be an object, when it exists at all');//plotif1
        cascadeData = cascadeTemplate(existingOrEmptyObject(plot.template), this.template);
        // validate the properties (with defaults from cascadeData) for the current plot
        /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
        test.ok((typeof plot.userName === 'string' && plot.userName.length > 0) || cascadeData.userName,
          REQUIRED_TYPE.supplant({context: context, path: 'a userName', type: 'a non-empty string'}));//plotif2
        test.ok((plot.apiKey === undefined && cascadeData.apiKey) || (typeof plot.apiKey === 'string' &&
          /^[a-z0-9]{10}$/.test(plot.apiKey)), REQUIRED_TYPE.supplant(
          {context: context, path: 'an apiKey', type: 'a string of 10 lowercase alphanumeric characters' }
        ));//plotif3

        // graphOptions is pulled from emptyTemplate if it exists nowhere else.
        // Just need to make sure it is undefined or an object
        test.ok(plot.graphOptions === undefined || isNonNullObject(plot.graphOptions),
          context + 'graphOptions property must be an object, or undefined');//plotif4
        obj = existingOrEmptyObject(plot.graphOptions);
        test.ok((obj.filename === undefined && cascadeData.graphOptions.filename) ||
          (typeof obj.filename === 'string' && obj.filename.length > 0),//plotif5
          REQUIRED_TYPE.supplant({context: context, path: 'a graphOptions.filename', type: 'a non-empty string'}));
        test.ok((obj.fileopt === undefined && cascadeData.graphOptions.fileopt) ||//plotif6
          (typeof obj.fileopt === 'string' && CONST.validationList.fileopt.includes(obj.fileopt)),
          REQUIRED_TYPE.supplant({context: context, path: 'a graphOptions.fileopt',
            type: 'a string from known values'}));
        /* jshint singleGroups: true */
        // userName, apiKey, plotData[], graphOptions filename, fileopt

        test.ok(Array.isArray(plot.plotData) && plot.plotData.length > 0,
          context + 'requires a plotData property as a non-empty Array');//plotif7
          // REQUIRED_TYPE.supplant({context: context, path: 'a graphOptions.plotData',
          // type: 'a non-empty Array'}));
        // which to do / call from here? which to have in separate unit test function?
        traces = Array.isArray(plot.plotData) ? plot.plotData : [];
        for (j = 0; j < traces.length; j += 1) {
          context = 'Plot ' + i + ', trace ' + j + ' ';
          test.ok(isNonNullObject(traces[j]),
            context + 'configuration must be an object');//trace1
          obj = existingOrEmptyObject(traces[j]);
          test.ok(obj.line === undefined || isNonNullObject(obj.line),
            context + 'line property must be an object');//trace2
          test.ok(obj.stream === undefined || isNonNullObject(obj.stream),
            context + 'stream property must be an object');//trace3
          test.ok(obj.transform === undefined || isNonNullObject(obj.transform),
            context + 'transform property must be an object');//trace4
          /* jshint singleGroups: false */// brackets not needed, but jslint wants for && expresions
          test.ok((obj.x === undefined && cascadeData.trace.x) || (Array.isArray(obj.x) && obj.x.length === 0),
            context + 'x property must be an empty array, or be used from the template path');//trace5
          test.ok((obj.y === undefined && cascadeData.trace.y) || (Array.isArray(obj.y) && obj.y.length === 0),
            context + 'y property must be an empty array, or be used from the template path');//trace6
          /* jshint singleGroups: true */
        }// ./for (j = 0; j < traces.length; j += 1)
      }// ./if (isNonNullObject(this.plots[i]))
    }// ./for (i = 0; i < this.plots.length; i += 1)
    // No duplicate ids in a single plot
    // No duplicate tokens anywhere
    // userName and apiKey can be duplicated; file name too, if different userName+apiKey

    // logName = {};
    // for (i = 0; i < keys.length; i += 1) {
    //   test.strictEqual(this.eventSource[keys[i]], true, keys[i] + ' is not an id for a used pin');
    //   test.strictEqual(logName[base.traceLookup[keys[i]]], undefined,
    //     base.traceLookup[keys[i]] + ' is not a unique trace identifier');
    //   logName[base.traceLookup[keys[i]]] = true;
    // }

    test.done();
  //},
  // 'console data transform': function (test) {
  //   // check (optional) data translation / scaling / transform
  //
  //   test.done();
  },
  // 'plotly logging': function (test) {
  //   /* jshint maxcomplexity: 14, maxstatements: 40 */
  //   var cfg, logModule, plt, ent, traces, trace, trcTmplt, tkn, tokenSet;
  //   cfg = config.logging;
  //   logModule = cfg && cfg.activeModule ? path.basename(cfg.activeModule, '.js') : '';
  //   if (logModule !== 'plotlyLogging') {
  //     test.expect(0);
  //     test.done();
  //     return;
  //   }
  //
  //   // user configuration validation when the plotlyLogging module is being used
  //   plt = Array.isArray(cfg.plotdata) ? cfg.plotdata : [];
  //   tkn = Array.isArray(cfg.tokens) ? cfg.tokens : [];
  //   traces = plt.length;
  //   test.expect(11 + traces * 6 + tkn.length * 3);
  //
  //   test.ok(Array.isArray(cfg.plotdata), 'should have plotdata array property');
  //   test.ok(Array.isArray(cfg.tokens), 'should have plotly tokens array property');
  //   test.strictEqual(traces, Object.keys(cfg.traceLookup || {}).length,
  //     'Must have the same number of plotdata traces configured as there are lookups');
  //   test.strictEqual(traces, tkn.length,
  //     'Must have the same number of plotdata traces configured as there are plotly tokens');
  //   test.ok(cfg.traceTemplate === undefined || isNonNullObject(cfg.traceTemplate),
  //     'traceTemplate should be an object, when the property exists at all');
  //
  //   // Validate each of the trace objects: required properties that do not exist
  //   // in the individual traces could be picked up from the (optional) traceTemplate
  //   trcTmplt = existingOrEmptyObject(cfg.traceTemplate);
  //   for (trace = 0; trace < traces; trace += 1) {
  //     /* jshint singleGroups: false */
  //     test.ok(isNonNullObject(cfg.plotdata[trace]), 'Trace entry ' + trace + ' must be a non-null object');
  //     ent = existingOrEmptyObject(cfg.plotdata[trace]);
  //     test.ok(ent.x === undefined && (trcTmplt.x !== undefined || Array.isArray(ent.x)),
  //       'Trace entry ' + trace + ' must have an x property array, when not supplied by the template');
  //     test.ok(ent.y === undefined && (trcTmplt.y !== undefined || Array.isArray(ent.y)),
  //       'Trace entry ' + trace + ' must have an y property array, when not supplied by the template');
  //     test.ok(isOptionalString(ent.name),
  //       'Trace entry ' + trace + ' name must be a string when the property exists at all');
  //     ent = existingOrEmptyObject(ent.stream);
  //     test.strictEqual(ent.token, undefined, 'Trace template stream should not have a token property');
  //     test.ok(ent.maxPoints === undefined || (parseInt(ent.maxPoints, 10) === parseFloat(ent.maxPoints) &&
  //       ent.maxPoints > 1),
  //       'maxPoints in stream of must be a positive integer, if the property exists at all');
  //   }
  //
  //   // Do a minimal sanity check on the plotly tokens
  //   tokenSet = {};
  //   for (trace = 0; trace < tkn.length; trace += 1) {
  //     test.strictEqual(typeof tkn[trace], 'string', 'Token key ' + trace + ' should be a string');
  //     test.ok(/^[a-z0-9]{10}$/.test(tkn[trace]),
  //       'token ' + trace + ' (' + tkn[trace] + ') should be 10 alpha numeric characters, all lower case');
  //     test.strictEqual(tokenSet[tkn[trace]], undefined,
  //       'Token ' + trace + ' (' + tkn[trace] + ') is a duplicate of token ' + tokenSet[tkn[trace]]);
  //     tokenSet[tkn[trace]] = trace;
  //   }
  //
  //   test.done();
  // },
  'plotly trace templates': function (test) {
    /* jshint maxcomplexity: 8 */
    var aTemplate, i, context;

    // Valadation for the cascading plotly templates.  This just needs to check for
    // properties that should NEVER exist in a template, because they are always unique
    //IDEA: check for correct datatype of known template properties here, or in
    // 'plotly configuration'??  here I think
    test.expect(19 * (this.plots.length + 1));

    test.ok(this.base.template === undefined || isNonNullObject(this.base.template),
      'Main plotly template must be an object, when it exists at all');
    aTemplate = cascadeTemplate(existingOrEmptyObject(this.template), CONST.emptyTemplate);

    // Check for properties that should never existing in a template
    // The function performs a number of assertions equal to the number of non-object
    // properties (nested) in the nonTemplate object
    context = 'Main ';
    detectBadProperties(CONST.nonTemplate, aTemplate, test, context);
    // Verify the datatype (and where possible contents) of all known template properties
    validateTemplateProperties(aTemplate, test, context);

    // Repeat above checks for the template in each plot configuration
    for (i = 0; i < this.plots.length; i += 1) {
      context = 'plot ' + i + ' ';
      test.ok(this.plots[i].template === undefined || isNonNullObject(this.plots[i].template),
        context + 'template must be an object, when it exists at all');
      aTemplate = cascadeTemplate(existingOrEmptyObject(this.plots[i].template), CONST.emptyTemplate);
      detectBadProperties(CONST.nonTemplate, aTemplate, test, context);
      validateTemplateProperties(aTemplate, test, context);
    }

    test.done();
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
