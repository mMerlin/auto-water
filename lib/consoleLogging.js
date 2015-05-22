/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';

// Log data to the console.  Use to get enough output to test what is being logged

var config = require('../.private/userinfo.js').logging.consoleLogging;
var initDone = false;
var setupComplete = false;
var message = {
  doubleInit: 'Can not initialize logging multiple times',
  missingInit: 'Call init before calling {context}',
  afterSetup: 'Can not add additional {context} instances after finishing setup',
  doubleEnd: 'Can not end logging setup multiple times',
  duplicateComponent: 'Duplicate {context} id seen: {id}',
  missingBoard: 'Call addBoard at least once before calling finalize',
  noLogable: 'No array of logable component ids passed to init'
};
var loggedSensors = {};
var loggedBoards = {};

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
 * @param {number} trace          the trace number / id
 * @param {number} time           milliseconds from Date.now()
 * @param {number} yValue         value for trace @ time milliseconds
 * @return {undefined}
 */
function addTracePoint(trace, time, yValue) {
  console.log('trace:', trace, 'data:',
    new Date(time).toISOString(), yValue);
}

/**
 * Record sensor data
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
function recordTrace(err, value) {
  /* jshint validthis:true */
  if (config.traceLookup[this.id] === undefined) {
    // console.log('No logging configured for', this.id);//DEBUG
    return err;// Just so lint does not complain about unused parameters
  }
  addTracePoint(config.traceLookup[this.id], Date.now(), value);
}

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

  trace = config.traceLookup[component.id];
  if (trace === undefined) {
    // Ignore events for components that do not have logging configured
    // console.log('No logging configured for', component.id);//DEBUG
    return;
  }
  changeTime = Date.now();
  addTracePoint(trace, changeTime, newState);
}

function initializeConsoleLogging(callback, logable) {
  var i;
  // console.log(nowString(), 'start initialize Console logging');//trace
  if (initDone) {
    throw new Error(message.doubleInit);
  }
  initDone = true;// Prevent rerun of initialization

  for (i = 0; i < config.traceLookup; i += 1) {
    if (!logable.includes(config.traceLookup[i])) {
      console.log('"' + config.traceLookup[i] +
        '"is not a logable component id');
    }
  }

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
  var context = 'Sensor';
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'add' + context }));
  }
  if (setupComplete) {
    throw new Error(message.afterSetup.supplant({ context: context }));
  }
  if (config.traceLookup[component.id] === undefined) {
    // console.log('No logging configured for', component.id);//DEBUG
    return;
  }
  if (loggedSensors[component.id]) {
    throw new Error(message.duplicateComponent.supplant({
      context: context,
      id: component.id
    }));
  }
  loggedSensors[component.id] = true;

  // Sensor instances 'inherit' from EventEmitter, so the listener can hook
  // directly to the data source
  component.addListener('data', recordTrace);
}

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
  if (loggedBoards[emitter.id]) {
    throw new Error(message.duplicateComponent.supplant({
      context: context,
      id: emitter.id
    }));
  }
  loggedBoards[emitter.id] = true;
  emitter.addListener('stateChange', recordStateChange);
}

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
  if (Object.keys(loggedBoards).length === 0) {
    throw new Error(message.missingBoard);
  }
  setupComplete = true;
}

module.exports = {
  init: initializeConsoleLogging,
  addSensor: addSensorEventHandler,
  addBoard: addControlEventHandler,
  finalize: finalizeLoggingSetup
};
