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

var initDone = false;
var setupComplete = false;
var message = {
  doubleInit: 'Can not initialize logging multiple times',
  missingInit: 'Call init before calling {context}',
  afterSetup: 'Can not add additional {context} instances after finishing setup',
  doubleEnd: 'Can not end logging setup multiple times',
  duplicateComponent: 'Duplicate {context} id seen: {id}',
  missingBoard: 'Call addBoard at least once before calling finalize'
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

function initializeNullLogging(callback) {
  if (initDone) {
    throw new Error(message.doubleInit);
  }
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
  finalize: recordEndSetup
};
