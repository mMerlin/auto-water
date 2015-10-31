/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';

// Log data to the console.  Use to get enough output to test what is being logged

var events = require('events');
var config;
var initDone = false;
var setupComplete = false;
var message = {
  doubleInit: 'Can not initialize logging multiple times',
  missingInit: 'Call init before calling {context}',
  afterSetup: 'Can not add additional {context} instances after finishing setup',
  doubleEnd: 'Can not end logging setup multiple times',
  duplicateComponent: 'Duplicate {context} id seen: {id}',
  missingBoard: 'Call addBoard at least once before calling finalize',
  notFunction: 'The callback parameter must be a function',
  noConfigIds:
    'The loggingConfig parameter must be an array with at least one member',
  notEmitter: 'The {context} to be logged is not an EventEmitter',
  badListener: '{event} logging event received for unconfigured component "{id}"',
  badEvent: '"{event}" is not recognized logging event for "{context}" "{id}"',
  dummyMaker: 'end of messages'
};
var loggedComponents = {};
var loggedComponents = {};

/**
 * Check if the passed argument is a 'normal' object (not null or an Array)
 *
 * @param {object} obj          variable to check
 * @return {boolean}
 */
// function isNonNullObject(obj) {
//   return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
// }

/**
 * Substitute variable 'markers' in a string with property values from an object
 *
 * ref: http://javascript.crockford.com/remedial.html
 *
 * properties in the object with no matching variable marker are ignored
 *
 * usage:
 *  'string with {count} variable {desc} to be {operation}.'.supplant({
 *    desc: 'markers',
 *    count: 'any',
 *    docs: 'ignored property',
 *    operation: 'replaced'
 *  })
 *
 * @param {object} o      object with variable subsitution properties
 * @return {string}
 */
if (!String.prototype.supplant) {
  /* jshint freeze: false */
  String.prototype.supplant = function (o) {
    /*jslint regexp: true */
    return this.replace(
      /\{([^{}]*)\}/g,
      function (a, b) {
        var r = o[b];
        return typeof r === 'string' || typeof r === 'number' ? r : a;
      }
    );
  };
  /* jshint freeze: true */
}

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

// function nowString() { return new Date().toISOString(); }//trace

/**
 * Log a trace data point
 *
 * @param {number} source         the date source event
 * @param {number} trace          the trace number / id
 * @param {number} time           milliseconds from Date.now()
 * @param {number} yValue         value for trace @ time milliseconds
 * @return {undefined}
 */
function addTracePoint(source, trace, time, yValue) {
  console.log('Trace:', trace + '; source event:', source + '; recorded at:',
    new Date(time).toISOString() + '; value:', yValue);
}

/**
 * Record sensor data events
 *
 * 'data' event handler
 *
 * 'this' is the sensor the data event is for
 * this.raw === this.value; value === median
 *
 * @param {object} err        error object (always null)
 * @param {number} value      median of values since previous event
 * @return {undefined}
 */
function recordDataTrace(err, value) {
  /* jshint validthis:true */
  if (!config[this.id]) {
    // No logging configured for component, where did the listener come from?
    if (err !== null) {
      // Just so lint does not complain about unused parameters
      throw new Error(err);
    }
    throw new Error(message.badListener.supplant({ event: 'data', id: this.id }));
  }
  addTracePoint('data', config[this.id].trace, Date.now(), value);
}// ./function recordDataTrace(err, value)

/**
 * Record sensor change events
 *
 * 'change' event handler
 *
 * 'this' is the sensor the data event is for
 * this.raw === this.value; value === median
 *
 * @param {object} err        error object (always null)
 * @param {number} value      median of values since previous event
 * @return {undefined}
 */
function recordChangeTrace(err, value) {
  /* jshint validthis:true */
  if (!config[this.id]) {
    // No logging configured for component, where did the listener come from?
    if (err !== null) {
      // Just so lint does not complain about unused parameters
      throw new Error(err);
    }
    throw new Error(message.badListener.
      supplant({ event: 'change', id: this.id }));
  }
  addTracePoint('change', config[this.id].trace, Date.now(), value);
}// ./function recordChangeTrace(err, value)

/**
 * Controlling device state change event logging
 *
 * 'stateChange' event handler
 *
 * 'this' is the parent board for the component
 *
 * Can not easily set 'this' to be the component, because controlling devices
 * (johnny-five Relay components) are not EventEmitter class objects.  Using the
 * board instead, and passing the 'source' component as the first parameter.
 *
 * @param {object} component  johnny-load extended johny-five (relay) component
 * @param {number} oldState   the (before change) state of the component
 * @param {number} newState   the (after change) state of the component
 * @return {undefined}
 */
function recordStateChange(component, newState) {//, oldState
  /* jshint validthis:true */
  var trace, changeTime;

  trace = config[component.id];
  if (trace === undefined) {
    // Ignore events for components that do not have logging configured
    return;
  }
  changeTime = Date.now();
  addTracePoint('stageChange', trace.trace, changeTime, newState);
}

/**
 * Initialize data logging for simple console output
 *
 * loggingConfig: [
 *   { id: {string}, trace: {string}, record: {string|Array of string} }... ]
 *   trace property is optional: defaults to id
 *   record property is optional: defaults to 'data' for sensors, 'stateChange'
 *     for others
 *
 * @param {Function} callback   function to execute when data logging is ready
 * @param {Array} components    components ids that could have logging events
 * @param {Object} loggingConfig package specific datalogging configuration
 * @return {undefiend}
 */
function initializeConsoleLogging(callback, components, loggingConfig) {
  var i;
  if (initDone) {
    throw new Error(message.doubleInit);
  }
  if (typeof callback !== 'function') {
    throw new Error(message.notFunction);
  }
  if (!(Array.isArray(loggingConfig) && loggingConfig.length > 0)) {
    throw new Error(message.noConfigIds);
  }

  config = {};
  for (i = 0; i < loggingConfig.length; i += 1) {
    // console.log('DBG: consoleLogging.init entry',
    //   i, 'is\n', JSON.stringify(loggingConfig[i]));//DEBUG
    if (!components.includes(loggingConfig[i].id)) {
      throw new Error('trace ' + i + ' ("' + loggingConfig[i].id +
        '") is not a logable component id');
    }
    config[loggingConfig[i].id] = {
      trace: JSON.
        parse(JSON.stringify(loggingConfig[i].trace || loggingConfig[i].id)),
      record: JSON.parse(JSON.stringify(loggingConfig[i].record || 'default'))
    };
  }

  initDone = true;// Prevent rerun of initialization
  // initDone = false;//DEBUG for setting up unit tests

  console.log('Console logging module initialized');
  process.nextTick(callback);
}// ./function initializeConsoleLogging(callback)

/**
 * Add listener for raw data events for a single sensor
 *
 * Depending on logging choices, this could use the change event instead
 *
 * @param {object} component  johnny-five component instance
 * @return {undefined}
 */
function addSensorEventHandler(component) {
  /* jshint maxcomplexity: 11 */
  var log, stream, i, context = 'Sensor';
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'add' + context }));
  }
  if (setupComplete) {
    throw new Error(message.afterSetup.supplant({ context: context }));
  }
  if (loggedComponents[component.id]) {
    throw new Error(message.duplicateComponent.
      supplant({ context: context, id: component.id }));
  }
  // Sensor instances 'inherit' from EventEmitter, so the listener should be
  // able to hook directly to the data source
  // typeof component.addListener !== 'function'
  if (!(component instanceof events.EventEmitter)) {
    throw new Error(message.notEmitter.supplant({ context: context }));
  }

  if (config[component.id]) {
    log = config[component.id].record;
    if (log === 'default') {
      log = 'data';
    }
    stream = typeof log === 'string' ? [log] : JSON.parse(JSON.stringify(log));
    for (i = 0; i < stream.length; i += 1) {
      if (stream[i] === 'data') {
        component.addListener('data', recordDataTrace);
      } else if (stream[i] === 'change') {
        component.addListener('change', recordChangeTrace);
      } else {
        throw new Error(message.badEvent.
          supplant({ event: stream[i], context: context, id: component.id }));
      }
    }
    loggedComponents[component.id] = true;
  }
}// ./function addSensorEventHandler(component)

/**
 * Add listener for all control state change events for a single board
 *
 * @param {object} component        johnny-five board, or component on board
 * @return {undefined}
 */
function addControlEventHandler(component) {
  var emitter, context = 'Board';
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'add' + context }));
  }
  if (setupComplete) {
    throw new Error(message.afterSetup.supplant({ context: context }));
  }
  emitter = component.board || component;
  if (loggedComponents[emitter.id]) {
    throw new Error(message.duplicateComponent.
      supplant({ context: context, id: emitter.id }));
  }
  if (!(emitter instanceof events.EventEmitter)) {
    throw new Error(message.notEmitter.supplant({ context: context }));
  }

  emitter.addListener('stateChange', recordStateChange);
  loggedComponents[emitter.id] = true;
}// ./function addControlEventHandler(component)

/**
 * Check that all needed information has been provide to log the configured
 * information
 *
 * @return {undefined}
 */
function finalizeLoggingSetup() {
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'finalize' }));
  }
  if (setupComplete) {
    throw new Error(message.doubleEnd);
  }
  if (Object.keys(loggedComponents).length <= 0) {
    throw new Error(message.missingBoard);
  }

  setupComplete = true;
}

module.exports = {
  init: initializeConsoleLogging,
  addSensor: addSensorEventHandler,
  addBoard: addControlEventHandler,
  finalize: finalizeLoggingSetup,
  fullReset: function () {
    // Not part of the official API: to aid automated tested with nodeunit.
    // Since I have not found a way to get node.js / nodeunit to do a complete
    // reload of a 'require'd file, this gives a backdoor reset to allow multiple
    // test cases that follow different paths
    initDone = false;
    setupComplete = false;
    loggedComponents = {};
  }
};
