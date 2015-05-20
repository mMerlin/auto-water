/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';

/* Handle all communitions with the Plot.ly api.  This includes setup, and any
   data stream logging.
 */

var config = require('../.private/userinfo.js').logging;
// var Plotly = require('plotly');
// var plotly = new Plotly(config.userName, config.apiKey);
var plotly = require('mock-plotly')(config.userName, config.apiKey);
// var plotly = require('plotly')(config.userName, config.apiKey);
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

var plotdata, plotTraces, deepCopyStandardObject,
  buildPlotData, plotlyCommunicationEstablished, isPlotReady;
// Constants
var multipleStreams = 'All Streams Go!';
var plotlyHeartRate = 30000;  // once every 30 seconds: Limit is 1 minute
// throttleTime: 100 // milliseconds

plotTraces = [];

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

function nowString() { return new Date().toISOString(); }//DEBUG

// Only needs refresh twice a year, to handle daylight savings time changes
// A restart will do the needed refresh
var tzOffset = new Date().getTimezoneOffset() * 60000;// milliseconds from GMT
/**
 * Create a formatted (for plotly) date string from a 'standard' timestamp
 *
 * @param {Date} timePoint        System time stamp (ISO/GMT)
 * @return {string}
 */
function getDateString(timePoint) {
  return new Date(timePoint - tzOffset).toISOString().
    replace('T', ' ').substr(0, 23);
}// ./function getDateString()

function reportObjectContents(obj) {
  var p, pType;
  for (p in obj) {
    if (obj.hasOwnProperty(p)) {
      pType = typeof obj[p];
      if (pType === 'string' && obj[p].length === 0) {
        pType = 'ignore';
      }
      if (pType === 'string' || pType === 'number') {
        console.log(p + ':', obj[p]);
      } else if (pType !== 'ignore') {
        // Unhandled property type
        console.log(p, 'is type', pType);
      }
    // } else {//DEBUG
    //   console.log('found inherited property:', p);//DEBUG
    }
  }
}

/**
 * Send heart beat / keep alive signal to each open plotly stream
 *
 * 'this' is the array of trace objects
 *
 * @return {undefined}
 */
function doHeartbeat() {
  /* jshint validthis: true */
  var i, nTraces;
  console.log(nowString(), 'heartbeat');//trace
  nTraces = this.length;
  for (i = 0; i < nTraces; i += 1) {
    this[i].write('\n');
    // data point throttling is for json.  No JSON here, so should not need to
    // insert any artificial delay.
  }
}// .//function doHeartbeat()

/***
 * Handle cleanup when a plotly stream is closed.
 *
 * callback function when stream is created.  Current processing logic never
 * triggers this callback.  Seems to need the stream to be explicitly closed.
 *
 * @param {object} err      error object
 * @param {object} res      response object
 * @return {undefined}
 */
function streamFinished(err, res) {
  /* jshint validthis: true */
  if (err) {
    console.log('streaming failed:');
    console.log(err);
    process.exit();
  }
  console.log('streamed response:', res);
  console.log(this);// Explore the callback context//DEBUG
}// ./function streamFinished(err, res)

function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}
deepCopyStandardObject = function (obj) {
  /* jshint validthis: true */
  /* jshint maxcomplexity: 10 */
  var copy, key;
  if (obj === null || obj === undefined || typeof obj === 'number' ||
      typeof obj === 'string') {
    return obj;// Just return primitive datatypes
  }
  if (Array.isArray(obj)) {
    copy = [];
    for (key = 0; key < obj.len; key += 1) {
      copy[key] = deepCopyStandardObject(obj[key]);// deep copy array elements
    }
    return copy;
  }
  if (typeof obj !== 'object') {
    throw new Error('Can not deep copy ' + typeof obj + ' properties');
  }
  copy = {};
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepCopyStandardObject(obj[key]);// deep copy object properties
    }
  }
  return copy;
};
function walkAndCopyMissing(src, dest) {
  var p;
  for (p in src) {
    if (src.hasOwnProperty(p)) {
      if (dest[p] === undefined) {
        // propery p does not exist in destination, deep copy from source
        dest[p] = deepCopyStandardObject(src[p]);
      } else if (isNonNullObject(src[p]) && isNonNullObject(dest[p])) {
        // source and destination properties are both non-null objects,
        // recursively walk the property trees
        walkAndCopyMissing(src[p], dest[p]);
      }
    }
  }
}

// /**
//  * Create an object with properties to control datalogging for a single trace
//  *
//  * This object will need to be populated by any data logging module.
//  *
//  * @param {Integer} trace     The trace number (key)
//  * @return {undefined}
//  */
// function buildTraceEntry(trace) {
//   var traceEntry = {
//     key: trace
//   };
//   traceEntry.name = plotdata[trace].name || 'Trace ' + trace;
//   // Vary on/off by type/class? (only for controls not sensors)
//   traceEntry.off = plotdata[trace].off || 0;
//   traceEntry.on = plotdata[trace].on || 1;
//   if (plotdata[trace].minScaled !== undefined) {
//     traceEntry.minScaled = plotdata[trace].minScaled;
//     traceEntry.maxScaled = plotdata[trace].maxScaled;
//   }
//   traceEntry.keepAlive = plotdata[trace].maxNoTrace || null;
//   // traceEntry.logpoint = addTracePoint.bind(trace);
//   return traceEntry;
// }

/**
 * Add a single data point to a plot trace
 *
 * 'this' is the trace number
 *
 * @param {object} xValue     X coordinate (number, date string) of the data point
 * @param {number} xValue     Y coordinate of the data point
 * @return {data type}
 */
function streamDataPoint(xValue, yValue, debugData) {
  /* jshint validthis: true */
  // console.log(nowString(), 'start streamDataPoint');//trace
  console.log('trace', this, 'data:', xValue, yValue, debugData);//DEBUG
  plotTraces[this].write(JSON.stringify({
    x: xValue,
    y: yValue
  }) + '\n');
}

function addTracePoint(trace, time, yValue, debugData) {
  // console.log(nowString(), 'start addTracePoint');//trace
  // 'emit' the remote data logging request, so that failures (hopefully) do not
  // affect the actual processing
  process.nextTick(streamDataPoint.bind(trace, getDateString(time), yValue,
    debugData));
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
function recordStateChange(component, oldState, newState) {
  /* jshint validthis:true */
  var trace, changeTime;

  trace = config.traceLookup[component.id];
  if (trace === undefined) {
    // Ignore events for components that do not have logging configured
    // console.log('No logging configured for', component.id);//DEBUG
    return;
  }
  changeTime = Date.now();
  //TODO: need lookup of on/off trace values from configuration
  addTracePoint(trace, changeTime, oldState);
  addTracePoint(trace, changeTime, newState);
}

/***
 * Initialize communications with the plot.ly data streaming api
 *
 * @param {Object} board          reference to be access johnny-five methods
 * @param {Function} callback     function to execute when data logging is ready
 * @return {undefined}
 */
function initializePlotly(callback) {
  console.log(nowString(), 'start initialize Plotly');//trace
  if (initDone) {
    throw new Error(message.doubleInit);
  }
  initDone = true;// Prevent rerun of initialization

  //Save in module scope, so do not need to keep passing through other callbacks

  buildPlotData();

  plotly.plot(
    plotdata,
    config.graphOptions,
    plotlyCommunicationEstablished.bind(null, callback)
  );
  console.log(nowString(), 'plotly callback configured');//trace
}// ./function initializePlotly(aBoard, callback)

/***
 * Populate a plotdata array with trace 'details' from template, tokens, more
 *
 * @return {undefined}
 */
buildPlotData = function () {
  /* jshint maxcomplexity: 10 */
  var tNum, tCount, template, tName, p;
  console.log(nowString(), 'start buildPlotData');//trace
  // [Deep] copy the plot configuration data, so that the original does not get
  // messed with.
  // Probably not really needed, but seems 'safest'
  plotdata = JSON.parse(JSON.stringify(config.plotdata));// Module scope
  template = config.traceTemplate || {};

  // 'invert' the traceLookup.  As is, it can be used to easily get a trace
  // number based on a component id.  Need to (here) get a component id, to use
  // as the default trace name, based on the trace number.
  tName = [];
  tCount = 0;
  for (p in config.traceLookup) {
    if (config.traceLookup.hasOwnProperty(p)) {
      tNum = config.traceLookup[p];
      if (tName[tNum] !== undefined) {
        throw new Error('Comonent id "' + tName[tNum] + '" and "' + p +
          '" are both configured to use trace ' + tNum);
      }
      tName[config.traceLookup[p]] = p;
      tCount += 1;
    }
  }
  if (tCount !== plotdata.length || tCount !== config.tokens.length) {
    throw new Error('Invalid plotly configuration data: must have same number' +
      ' of trace lookup entries, plotdata traces, and tokens');
  }

  // Fill in any unspecified trace options from the template plus component ids
  for (tNum = 0; tNum < tCount; tNum += 1) {
    walkAndCopyMissing(template, plotdata[tNum]);
    if (plotdata[tNum].name === undefined) {
      plotdata[tNum].name = tName[tNum];// Default trace name
    }

    // Fill in the token to use for the trace stream
    if (plotdata[tNum].stream === undefined) {
      plotdata[tNum].stream = {};
    }
    plotdata[tNum].stream.token = config.tokens[tNum];
  }
  // console.log(JSON.stringify(plotdata));//DEBUG
};

/**
 * Continue processing when plot.ly has finished setting up the plot.
 *
 * @private
 * @param {Object} err      error object
 * @param {Object} msg      plot creation details object
 * @return {undefined}
 */
plotlyCommunicationEstablished = function (callback, err, msg) {
  var trace;//, traces;
  console.log(nowString(), 'start plotlyCommunicationEstablished');//trace
  if (!isPlotReady(err, msg)) {
    throw new Error('Failed to complete Plotly Streaming API setup');
    // process.exit();
  }

  // traces = [];
  for (trace = 0; trace < plotdata.length; trace += 1) {
    plotTraces[trace] = plotly.stream(plotdata[trace].stream.token,
      streamFinished);
    // traces[trace] = buildTraceEntry(trace);
  }

  process.nextTick(callback);
  console.log('\nplotly data logging setup\n');// report
};// ./function plotlyCommunicationEstablished(callback, err, msg)

/***
 * Check and report the information supplied to the callback function when
 * a streaming plot configuration was reqested
 *
 * @param {Object} err      error object
 * @param {Object} msg      plot creation details object
 * @return {boolean}
 */
isPlotReady = function (err, msg) {
  console.log(nowString(), 'start isPlotReady');//trace
  if (err) {
    // Just report the problem and exit, could not initialize plotly
    console.log('Failed to initialize Plotly plot');//report
    if (typeof err !== 'object') {
      // Strange situation; report what we can
      console.log('Unexpected err verification parameter');
      console.log(err);
      return false;
    }
    if (err.statusCode !== 200) {
      console.log('Communications status code:', err.statusCode);
    }
    reportObjectContents(err.body);
    return false;
  }

  // Plot initialization succeeded.  Or actually did not 'crash'
  // Check for successfull execution, but failure result
  if (typeof msg !== 'object') {
    // Unexpect situation.  Report whatever we can and die
    console.log('Unexpected msg verification parameter');
    console.log(msg);
    return false;
  }
  if (msg.streamstatus !== multipleStreams) {
    if (msg.streamstatus !== undefined) {
      console.log('Unexpected graph stream status.');//report
      console.log('Are there really multiple traces configured?');//report
      console.log('Expected:', multipleStreams);//report
      console.log('Actual:  ', msg.streamstatus);//report
    }
    reportObjectContents(msg);
    return false;
  }

  console.log('\nPlot being created at:', msg.url, '\n');//report
  return true;
};// ./function isPlotReady(err, msg)

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
 * With the sequence of calls and callbacks, this could get called after init
 * was called (and method record), but before plotly as finished setting up
 * communications.  This does not currently depended on that, so there does
 * not appear to be any conflict.
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
  // Safe reference to board, not just (boolean) that it has been seen
  loggedBoards[emitter.id] = emitter;
  emitter.addListener('stateChange', recordStateChange);
}

/**
 * Check that all needed information has been provide to log the configured
 * information
 *
 * With the current configuration information, there is not really enough detail
 * to tell if everything has been supplied.  Control component state change
 * events are handled generically.  Sensor components require individual calls
 * to configure logging, but the configuration data does not show which
 * component ids are sensors.  Only which trace to associated with each
 * component id, which could be either sensor or control.
 *
 * Depending on the desired loggging, there does not NEED to be any sensors
 * at all.
 *
 * @return {undefined}
 */
function finalizePlotlySetup() {
  var boardIds;
  if (!initDone) {
    throw new Error(message.missingInit.supplant({ context: 'finalize' }));
  }
  if (setupComplete) {
    throw new Error(message.doubleEnd);
  }
  boardIds = Object.keys(loggedBoards);
  if (boardIds.length === 0) {
    throw new Error(message.missingBoard);
  }

  console.log(nowString(), 'start heartbeat');//trace
  loggedBoards[boardIds[0]].loop(plotlyHeartRate, doHeartbeat.bind(plotTraces));

  setupComplete = true;
}

module.exports = {
  init: initializePlotly,
  addSensor: addSensorEventHandler,
  addBoard: addControlEventHandler,
  finalize: finalizePlotlySetup
};
