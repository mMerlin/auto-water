/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';

// Null module for data logging.  Use when no data logging is needed.  This does
// not even look at the configuration file.

var events = require('events');
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
  noComponents:
    'The component argument must be an array with at least one member',
  notNullConfig: 'The loggingConfig argument should be null',
  notEmitter: 'The component to be logged is not an EventEmitter',
  dummyMaker: 'end of messages'
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

function initializeNullLogging(callback, components, loggingConfig) {
  if (initDone) {
    throw new Error(message.doubleInit);
  }
  if (typeof callback !== 'function') {
    throw new Error(message.notFunction);
  }
  if (!(Array.isArray(components) && components.length > 0)) {
    throw new Error(message.noComponents);
  }
  if (loggingConfig !== null) {
    throw new Error(message.notNullConfig);
  }
  // console.log('noLogging Debug:', typeof components,
  //   Array.isArray(components), components.length);//DEBUG
  initDone = true;// Prevent rerun of initialization

  console.log('Null logging module initialized');
  process.nextTick(callback);
}// ./function initializeNullLogging(callback)

/**
 * Verify that a component is valid to add to the logging system context
 *
 * @private
 *
 * @param {object} component  johnny-five component instance
 * @param {string} context    name for the callers context
 * @param {object} previous   object holding previous component ids for context
 * @return {undefined}
 */
function validateComponentAddition(component, context, previous) {
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'add' + context }));
  }
  if (setupComplete) {
    throw new Error(message.afterSetup.supplant({ context: context }));
  }
  if (previous[component.id]) {
    throw new Error(message.duplicateComponent.supplant({
      context: context,
      id: component.id
    }));
  }
  if (!(component instanceof events.EventEmitter)) {
    throw new Error(message.notEmitter);
  }
  previous[component.id] = true;
}

function recordAddedSensor(component) {
  validateComponentAddition(component, 'Sensor', loggedSensors);
}

function recordAddedBoard(component) {
  var emitter;
  emitter = component.board || component;
  validateComponentAddition(emitter, 'Board', loggedBoards);
}

function recordEndSetup() {
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
  init: initializeNullLogging,
  addSensor: recordAddedSensor,
  addBoard: recordAddedBoard,
  finalize: recordEndSetup,
  fullReset: function () {
    // Not part of the official API: to aid automated tested with nodeunit.
    // Since I have not found a way to get node.js / nodeunit to do a complete
    // reload of a 'require'd file, this gives a backdoor reset to allow multiple
    // test cases that follow different paths
    initDone = false;
    setupComplete = false;
    loggedSensors = {};
    loggedBoards = {};
  }
};
