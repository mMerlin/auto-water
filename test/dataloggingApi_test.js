'use strict';
/*jslint sub: true, maxlen: 120 */
/* jshint maxlen:120 */

var MockFirmata = require("./util/mock-firmata"),
  five = require("johnny-five"),
  events = require("events"),
  Board = five.Board;
  // sinon = require("sinon"),
  // Sensor = five.Sensor,
var logableComponents = [
  "test component 1",
  "test component 2"
];
var datalog = [];
datalog.push({
  name: 'noLogging',
  api: require('../lib/noLogging.js'),
  config: null
});
datalog.push({
  name: 'consoleLogging',
  api: require('../lib/consoleLogging.js'),
  config: [{ id: logableComponents[0], trace: "testSensor" }]
});
datalog.push({
  name: 'plotlyLogging',
  api: require('../lib/plotlyLogging.js'),
  config: {
    authentication: [
      {
        userName: "plotlyTesting",
        apiKey: "testkey012",
        tokens: [
          "tst01token",
          "tst99token"
        ]
      }
    ],
    target: {
      userName: "plotlyTesting",
      graphOptions: {
        fileopt: "overwrite"
      }
    },
    plots: [
      {
        target: {
          graphOptions: {
            filename: "water/Sensors"
          }
        },
        trace: {
          mode: "lines",
          type: "scatter",
          line: {
            shape: "linear"
          },
          stream: {
            maxPoints: 800
          }
        },
        plotData: [
          { component: "test component 1" }
        ]
      }
    ]
  }
});

function dummyInitCallback() {
  return false;
}

var badArgSamples = [
  { value: undefined, context: 'undefined' },
  { value: true, context: 'boolean true' },
  { value: false, context: 'boolean false' },
  { value: 10, context: 'numeric' },
  { value: logableComponents[0], context: 'string' },
  { value: {}, context: 'empty object' },
  { value: { id: logableComponents[0] }, context: 'component object' },
  { value: [], context: 'empty array' },
  { value: [logableComponents[0]], context: 'array with component string',
    goodFor: { components: true }},
  { value: dummyInitCallback, context: 'function',
    goodFor: { callback: true }}
];
// { value: null, context: 'null',
//   goodFor: { configuration: ['noLogging'] }},
// { value: JSON.parse(JSON.stringify(datalog[1].config)), context: 'config object',
//   goodFor: { configuration: ['consoleLogging'] }},
var dIdx;
for (dIdx = 0; dIdx < datalog.length; dIdx += 1) {
  badArgSamples.push({
    value: JSON.parse(JSON.stringify(datalog[dIdx].config)),
    context: 'good for ' + datalog[dIdx].name,
    goodFor: { configuration: [datalog[dIdx].name]}
  });
}
// To keep the expected assert count calculations simple(r), keep and mark (only) one entry
// above as good for each datalogging module.


function isGoodArguments(argCase, context) {
  /* jshint singleGroups: false */
  // console.log(typeof argCase, typeof context);
  return argCase && ((argCase.callback && context.callback) ||
    (argCase.components && context.components) ||
    (argCase.configuration && argCase.configuration.includes(context.name))) ? true : false;
    /* jshint singleGroups: true */
}// ./function isGoodArguments(argCase, context)
// var tst;
// console.log('isGood for', datalog[0].name, 'callback');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { callback: true }));
// }
// console.log('isGood for', datalog[1].name, 'callback');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { callback: true }));
// }
// console.log('isGood for', datalog[0].name, 'components');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { components: true }));
// }
// console.log('isGood for', datalog[1].name, 'components');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { components: true }));
// }
// console.log('isGood for', datalog[0].name, 'configuration');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { name: datalog[0].name }));
// }
// console.log('isGood for', datalog[1].name, 'configuration');
// for (tst = 0; tst < badArgSamples.length; tst += 1) {
//   console.log(isGoodArguments(badArgSamples[tst].goodFor, { name: datalog[1].name }));
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

exports['logging initialized'] = {
  setUp: function (done) {
    // setup here
    var i, baseBoard, initCount;
    baseBoard = new Board({
      io: new MockFirmata(),
      debug: false,
      repl: false
    });
    // prevent 'not used' lint error
    if (baseBoard.id === undefined) {
      console.log('logging initialized.setup', baseBoard.id);
    }

    initCount = 0;
    function collectApiCallbacks() {
      initCount += 1;
      if (initCount >= datalog.length) {
        done();
      }
    }

    this.messageTemplate = '{method} should throw error with {context} argument for {name}';

    for (i = 0; i < datalog.length; i += 1) {
      datalog[i].api.fullReset();
      datalog[i].api.init(
        collectApiCallbacks,
        logableComponents,
        datalog[i].config
      );
    }
  },// ./function setup(done)
  'add board': function (test) {
    /* jshint maxstatements: 50 */
    var method, testCall, logger, i, dummyBoard;
    method = 'addBoard';

    function isBoardErr(err) {
      return err instanceof Error &&
        err.message === 'Call addBoard at least once before calling finalize';
    }
    function callWrapper() {
      testCall();
    }

    function makeBoard(boardId) {
      var newBoard = new Board({
        io: new MockFirmata(),
        debug: false,
        repl: false
      });
      newBoard.id = boardId;
      return newBoard;
    }

    test.expect(datalog.length * (badArgSamples.length + 12));

    for (logger = 0; logger < datalog.length; logger += 1) {
      testCall = datalog[logger].api[method].
        bind(null);
      test.throws(callWrapper, undefined, this.messageTemplate.supplant(
        { method: method, context: 'no component', name: datalog[logger].name }
      ));
      for (i = 0; i < badArgSamples.length; i += 1) {
        testCall = datalog[logger].api[method].
          bind(null, badArgSamples[i].value);
        test.throws(callWrapper, undefined, this.messageTemplate.supplant(
          { method: method, context: badArgSamples[i].context, name: datalog[logger].name }
        ));
      }// ./for (i = 0; i < badArgSamples.length; i += 1)

      // Attempting api.finalize before any boards successfully added should fail
      testCall = datalog[logger].api.finalize;
      test.throws(callWrapper, isBoardErr,
        'should get specific error message when finalize is called too soon for ' + datalog[logger].name);

      // Setup a valid (simulated) board, and do a succssful add
      dummyBoard = makeBoard('fakeJohnnyFiveBoard1');
      testCall = datalog[logger].api[method].
        bind(null, dummyBoard);
      test.doesNotThrow(callWrapper, undefined,
        method + ' should not throw an error with a good board argument for ' + datalog[logger].name);
      if (datalog[logger].name === 'noLogging') {
        test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 0,
          'should not have added stateChange listener for ' + datalog[logger].name);
      } else {
        test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 1,
          'should have added a single stateChange listener for ' + datalog[logger].name);
      }
      dummyBoard = makeBoard('fakeJohnnyFiveBoard1');
      test.throws(callWrapper, undefined,
        method + ' should throw error with previously added board ID for ' + datalog[logger].name);
      test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 0,
        'should not have added stateChange listener for ' + datalog[logger].name);

      dummyBoard = makeBoard('fakeJohnnyFiveBoard2');
      testCall = datalog[logger].api[method].
        bind(null, dummyBoard);
      test.doesNotThrow(callWrapper, undefined,
        method + ' should not throw an error with a second good board argument for ' + datalog[logger].name);
      if (datalog[logger].name === 'noLogging') {
        test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 0,
          'should not have added stateChange listener for ' + datalog[logger].name);
      } else {
        test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 1,
          'should have added a single stateChange listener for ' + datalog[logger].name);
      }

      testCall = datalog[logger].api.finalize;
      test.doesNotThrow(callWrapper, undefined,
        'finalize should not not throw an error with saved good board for ' + datalog[logger].name);
      test.throws(callWrapper, undefined,
        'should throw error for duplicate call to finalize for ' + datalog[logger].name);

      dummyBoard = makeBoard('fakeJohnnyFiveBoard1');
      testCall = datalog[logger].api[method].
        bind(null, dummyBoard);
      test.throws(callWrapper, undefined,
        method + ' should throw error if already finalized for ' + datalog[logger].name);
      test.strictEqual(events.EventEmitter.listenerCount(dummyBoard, 'stateChange'), 0,
        'should not have added stateChange listener for ' + datalog[logger].name);
    }// ./for (logger = 0; logger < datalog.length; logger += 1)

    test.done();
  },// ./'add board': function (test)
  'add sensor': function (test) {
    var method, testCall, logger, i, dummySensor;
    method = 'addSensor';

    function callWrapper() {
      testCall();
    }

    test.expect(datalog.length * (badArgSamples.length + 9));

    for (logger = 0; logger < datalog.length; logger += 1) {
      testCall = datalog[logger].api[method].
        bind(null);
      test.throws(callWrapper, undefined, this.messageTemplate.supplant(
        { method: method, context: 'no component', name: datalog[logger].name }
      ));
      for (i = 0; i < badArgSamples.length; i += 1) {
        testCall = datalog[logger].api[method].
          bind(null, badArgSamples[i].value);
        test.throws(callWrapper, undefined, this.messageTemplate.supplant(
          { method: method, context: badArgSamples[i].context, name: datalog[logger].name }
        ));
      }// ./for (i = 0; i < badArgSamples.length; i += 1)

      // Setup a valid (simulated) component, and do a succssful add
      dummySensor = new five.Sensor('A0');//board
      // dummySensor = new events.EventEmitter();
      dummySensor.id = logableComponents[0];
      testCall = datalog[logger].api[method].
        bind(null, dummySensor);
      test.doesNotThrow(callWrapper, undefined,
        method + ' should not throw an error with a good sensor argument for ' + datalog[logger].name);
      if (datalog[logger].name === 'noLogging') {
        test.strictEqual(events.EventEmitter.listenerCount(dummySensor, 'data') +
          events.EventEmitter.listenerCount(dummySensor, 'change'), 0,
          'should not have added data or change listener for ' + datalog[logger].name);
      } else {
        test.ok(events.EventEmitter.listenerCount(dummySensor, 'data') +
          events.EventEmitter.listenerCount(dummySensor, 'change') > 0,
          'should have added at least one data or change listener for ' + datalog[logger].name);
      }
      dummySensor = new five.Sensor('A0');
      dummySensor.id = logableComponents[0];
      test.throws(callWrapper, undefined,
        method + ' should throw error with previously added sensor ID for ' + datalog[logger].name);
      test.strictEqual(events.EventEmitter.listenerCount(dummySensor, 'data') +
        events.EventEmitter.listenerCount(dummySensor, 'change'), 0,
        'should not have added data or change listener for ' + datalog[logger].name);

      // Attempting to add a valid but not configured sensor should not throw an exception
      dummySensor = new five.Sensor('A0');
      dummySensor.id = logableComponents[1];
      testCall = datalog[logger].api[method].
        bind(null, dummySensor);
      test.doesNotThrow(callWrapper, undefined,
        method + ' should not throw an error with unlogged sensor argument for ' + datalog[logger].name);
      test.strictEqual(events.EventEmitter.listenerCount(dummySensor, 'data') +
        events.EventEmitter.listenerCount(dummySensor, 'change'), 0,
        'should not have added data or change listener for ' + datalog[logger].name);

      if (datalog[logger].name === 'noLogging') {
        // The noLogging modules does not have any logable configuration information.  It treats all
        // component ids as loggable, so complains about any attempt to add a duplicate sensor id.
        test.throws(callWrapper, undefined,
          method + ' should throw error with duplicate added sensor ID for ' + datalog[logger].name);
      } else {
        // Other modules ignore sensors that are not configured for logging, and do not notice attempts
        // to add them multiple times.
        test.doesNotThrow(callWrapper, undefined,
          method + ' should not throw an error with duplicate unlogged sensor argument for ' + datalog[logger].name);
      }
      test.strictEqual(events.EventEmitter.listenerCount(dummySensor, 'data') +
        events.EventEmitter.listenerCount(dummySensor, 'change'), 0,
        'should not have added data or change listener for ' + datalog[logger].name);
    }// ./for (logger = 0; logger < datalog.length; logger += 1)

    test.done();
  }// ./'add sensor': function (test)
};// ./exports['logging initialized']

exports['initialization failures'] = {
  setUp: function (done) {
    var i;


    for (i = 0; i < datalog.length; i += 1) {
      datalog[i].api.fullReset();
    }

    this.messageTemplate = 'init should throw error with {context} {arg} argument for {name}';

    done();
  },// ./function setup(done)
  'bad callback param': function (test) {
    var testCall, logger, testArg, i;

    function isFunctionErr(err) {
      return err instanceof Error &&
        err.message === 'The callback parameter must be a function';
    }
    function callWrapper() {
      testCall();
    }
    test.expect(datalog.length * (4 + (badArgSamples.length - 1)));

    for (logger = 0; logger < datalog.length; logger += 1) {
      // When multiple issues exist with passed arguments, which error occurs is
      // implementation dependent.  Only 'safe' to check that 'some' error occurs.
      testCall = datalog[logger].api.init;
      test.throws(callWrapper, Error,
        'should throw error when no arguments passed to init for ' + datalog[logger].name);

      // When only a single issue exists with the passed arguments, it is *possible* to check a bit
      // more specifically, but that still requires knowledge of the datalogging implementation.
      testArg = 'callback';
      for (i = 0; i < badArgSamples.length; i += 1) {
        if (!isGoodArguments(badArgSamples[i].goodFor, { callback: true })) {
          testCall = datalog[logger].api.init.
            bind(null, badArgSamples[i].value, logableComponents, datalog[logger].config);
          test.throws(callWrapper,
            undefined, this.messageTemplate.supplant(
              { context: badArgSamples[i].context, arg: testArg, name: datalog[logger].name }
            ));
        }
      }// ./for (i = 0; i < badArgSamples.length; i += 1)

      testCall = datalog[logger].api.init.
        bind(null, [dummyInitCallback], logableComponents, datalog[logger].config);
      test.throws(callWrapper, isFunctionErr,
        'should get specific error message when callback argument is not a single function for ' +
          datalog[logger].name);
      //
      // Do a successfull api.init call, to make sure not just failing on a generic error that has
      // nothing to do with the actual intended checks
      testCall = datalog[logger].api.init.
        bind(null, dummyInitCallback, logableComponents, datalog[logger].config);
      test.doesNotThrow(callWrapper, undefined,
        'should not throw error with valid init arguments for ' + datalog[logger].name);
      test.throws(callWrapper, undefined,
        'show throw an error attempting second init for ' + datalog[logger].name);
    }// ./for (logger = 0; logger < datalog.length; logger += 1)

    test.done();
  },// ./function 'bad callback param'(test)
  'bad components param': function (test) {
    var testCall, logger, testArg, i;

    function callWrapper() {
      testCall();
    }
    test.expect(datalog.length * (badArgSamples.length - 1));

    for (logger = 0; logger < datalog.length; logger += 1) {
      // When only a single issue exists with the passed arguments, it is *possible* to check a bit
      // more specifically, but that still requires knowledge of the datalogging implementation.
      testArg = 'components';
      for (i = 0; i < badArgSamples.length; i += 1) {
        console.log(JSON.stringify(badArgSamples[i].goodFor));
        if (!isGoodArguments(badArgSamples[i].goodFor, { components: true })) {
          console.log(JSON.stringify(badArgSamples[i].goodFor), datalog[logger], badArgSamples[i].context);
          testCall = datalog[logger].api.init.
            bind(null, dummyInitCallback, badArgSamples[i].value, datalog[logger].config);
          // noLogging does not throw an error for the 'config object' case, since it is a non-empty
          // array.  The array members do not get checked in the simple noLogging initialization
          if (datalog[logger].name === 'noLogging' && badArgSamples[i].context === 'config object') {
            test.doesNotThrow(callWrapper, undefined, 'init should not throw error with ' +
              badArgSamples[i].context + ' ' + testArg + ' argument for ' + datalog[logger].name);
          } else {
            // 'init should throw error with {context} {arg} argument for {name}';
            // 'good for consoleLogging components'; 'noLogging'
            test.throws(callWrapper,
              undefined, this.messageTemplate.supplant(
                { context: badArgSamples[i].context, arg: testArg, name: datalog[logger].name }
              ));
          }
        }
      }// ./for (i = 0; i < badArgSamples.length; i += 1)
    }// ./for (logger = 0; logger < datalog.length; logger += 1)

    test.done();
  },// ./function 'bad comonents param'(test)
  'bad configuration param': function (test) {
    var testCall, logger, testArg, i;

    // function isFunctionErr(err) {
    //   return err instanceof Error &&
    //     err.message === 'The callback parameter must be a function';
    // }
    function callWrapper() {
      testCall();
    }
    test.expect(1 + datalog.length * (badArgSamples.length - 1));

    for (logger = 0; logger < datalog.length; logger += 1) {
      // When only a single issue exists with the passed arguments, it is *possible* to check a bit
      // more specifically, but that still requires knowledge of the datalogging implementation.
      testArg = 'components';
      for (i = 0; i < badArgSamples.length; i += 1) {
        if (!isGoodArguments(badArgSamples[i].goodFor, { name: datalog[logger].name })) {
          testCall = datalog[logger].api.init.
            bind(null, dummyInitCallback, logableComponents, badArgSamples[i].value);
          test.throws(callWrapper,
            undefined, this.messageTemplate.supplant(
              { context: badArgSamples[i].context, arg: testArg, name: datalog[logger].name }
            ));
        }
      }// ./for (i = 0; i < badArgSamples.length; i += 1)

      testCall = datalog[logger].api.init.
        bind(null, dummyInitCallback, logableComponents);
      test.throws(callWrapper, undefined,
        'should throw error when datalogging configuration is missing for ' + datalog[logger].name);
    }// ./for (logger = 0; logger < datalog.length; logger += 1)

    test.done();
  }// ./function 'bad configuration param'(test)

};// ./exports['initialization failures']
