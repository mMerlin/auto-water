/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';

/* Handle all communitions with the Plot.ly api.  This includes setup, and any
 * data stream logging.
 */

var config = require('../.private/userinfo.js').logging.plotlyLogging;
// var Plotly = require('plotly');
var Plotly = require('mock-plotly');

var plotBlock, plotlyInstanceReady, deepCopyStandardObject,
  buildPlotData, plotlyCommunicationEstablished, isPlotReady;
var initDone = false;
var setupComplete = false;
var loggedSensors = {};
var loggedBoards = {};
var plotTraces = [];

// Constants

var multipleStreams = 'All Streams Go!';
var plotlyHeartRate = 30000;  // once every 30 seconds: Limit is 1 minute

var message = {
  doubleInit: 'Can not initialize logging multiple times',
  missingInit: 'Call init before calling {context}',
  afterSetup: 'Can not add additional {context} instances after finishing setup',
  doubleEnd: 'Can not end logging setup multiple times',
  duplicateComponent: 'Duplicate {context} id seen: {id}',
  missingBoard: 'Call addBoard at least once before calling finalize'
};

// A complete but empty template structure that can be merged in, to make sure
// that all property 'parents', exist, whether the properties do or not
var emptyTarget = {
  graphOptions: {}
};
// Include the empty x and y coordinate arrays, since all traces need them.
var emptyTrace = {
  x: [],
  y: [],
  line: {},
  stream: {},
  transform: {}
};

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
  };// ./function String.prototype.supplant
  /* jshint freeze: true */
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
function isNonNullObject(obj) {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}
/**
 * Extend and existing object with properties from another object
 *
 * Existing (array or primative) properties are not modified
 *
 * 'this' is the object being extended
 *
 * @param {Object} obj          source object for additional properties
 * @return {Object}
 */
if (!Object.prototype.extend) {
  /* jshint freeze: false */
  Object.prototype.extend = function (obj) {
    var p;
    for (p in obj) {
      if (obj.hasOwnProperty(p)) {
        if (this[p] === undefined) {
          // propery p does not exist in destination, deep copy from source
          this[p] = deepCopyStandardObject(obj[p]);
        } else if (isNonNullObject(obj[p]) && isNonNullObject(this[p])) {
          // source and destination properties are both non-null objects,
          // recursively walk the property trees
          this[p].extend(obj[p]);
        }
      }// ./if (obj.hasOwnProperty(p))
    }
    return this;
  };// ./function Object.prototype.extend(obj)
  /* jshint freeze: true */
}// ./if (!Object.prototype.extend)

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
 * @return {undefined}
 */
function doHeartbeat() {
  var i, j;
  for (i = 0; i < plotBlock.length; i += 1) {
    for (j = 0; j < plotBlock.stream.length; j += 1) {
      plotBlock[i].stream[j].stream.write('\n');

      //IDEA: opportunity to flush queued data streams
    }
  }
  // data point throttling is for json, and per stream.  No JSON here, and only
  // a single write per stream, so should not need to insert any artificial delay.
}// .//function doHeartbeat()

/**
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

/**
 * Add a single data point to a plot trace
 *
 * 'this' is the trace number
 *
 * @param {object} xValue     X coordinate (number, date string) of the data point
 * @param {number} xValue     Y coordinate of the data point
 * @return {data type}
 */
function streamDataPoint(xValue, yValue) {
  /* jshint validthis: true */
  // console.log(nowString(), 'start streamDataPoint');//trace
  var plotlyTimePoint = getDateString(xValue);
  console.log('trace', this, 'data:', plotlyTimePoint, yValue);//DEBUG
  plotTraces[this].write(JSON.stringify({
    x: plotlyTimePoint,
    y: yValue
  }) + '\n');
}

/**
 * Record sensor value from data read event
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
function recordAllData(err, value) {
  /* jshint validthis:true */
  if (err !== null) { console.log('Error parameter is ', typeof err); }// lint
  var i, j, strm;
  for (i = 0; i < plotBlock.length; i += 1) {
    strm = plotBlock[i].stream;
    for (j = 0; j < strm.length; j += 1) {
      if (strm[j].component === this.id) {
        // && strm[j].log === 'data'
        streamDataPoint(strm[j].name, Date.now(), value);
      }
    }
  }
}
function recordDataChange(err, value) {
  /* jshint validthis:true */
  //IDEA: add configuration option to only record changes
  //IDEA: is that going to need to allow duplicate components? only if both
  // data and change events record on the same plot, different traces.
  if (err) { return err; }
  return value;
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
  var i, j, strm;
  for (i = 0; i < plotBlock.length; i += 1) {
    strm = plotBlock[i].stream;
    for (j = 0; j < strm.length; j += 1) {
      if (strm[j].component === component.id) {
        // && strm[j].log === 'allstate'
        // 'toTrue', 'toFalse', 'toggle'
        //TODO: need lookup of on/off trace values from configuration
        streamDataPoint(strm[j].name, Date.now(), newState, oldState);
      }
    }
  }
  // Pass 'oldState' to the data streaming function, though it does not use it:
  // Keep lint happy about no unused variables / parameters
  //IDEA: Until add code to filter event logging based on state transitions
}

/**
 * Initialize communications with the plot.ly data streaming api
 *
 * @param {Function} callback   function to execute when data logging is ready
 * @param {Array} components    components ids that could have logging events
 * @return {undefined}
 */
function initializePlotly(callback, components) {
  var traceTemplate, plotTemplate, plotCount, plotData,
    targetTemplate, plotTarget, i;
  console.log(nowString(), 'start initialize Plotly');//trace
  if (initDone) {
    throw new Error(message.doubleInit);
  }
  initDone = true;// Prevent rerun of initialization

  // Create the base / global templates, even if they are empty
  targetTemplate = JSON.parse(JSON.stringify(config.target || {}));
  traceTemplate = JSON.parse(JSON.stringify(config.trace || {}));
  // Make sure that the base templates include all possible 'parent' propeties,
  // and application default property values
  targetTemplate.extend(emptyTarget);
  traceTemplate.extgend(emptyTrace);

  plotBlock = [];
  plotlyInstanceReady = [];
  plotCount = config.plots.length;
  for (i = 0; i < plotCount; i += 1) {
    // Build the plot specific trace template
    plotTemplate = JSON.parse(JSON.stringify(config.plots[i].trace || {}));
    plotTemplate.extend(traceTemplate);// Get any global template properties
    // Build the plot specific target information
    plotTarget = JSON.parse(JSON.stringify(config.plots[i].target || {}));
    plotTarget.extend(targetTemplate);

    plotBlock[i] = {
      plotly: new Plotly(plotTarget.username, plotTarget.apiKey)
    };

    plotData = buildPlotData(i, plotTemplate, components);

    // Examples: https://github.com/plotly/plotly-nodejs (search for plotly.plot)
    plotBlock[i].plotly.plot(
      plotData,
      plotTarget.graphOptions,
      plotlyCommunicationEstablished.bind(null, i, plotCount, callback)
    );
  }// ./for (i = 0; i < plotCount; i += 1)

  console.log(nowString(), 'plotly callback configured');//trace
}// ./function initializePlotly(aBoard, callback)

/**
 * Collect information needed to log configured events for a single plot
 *
 * @param {Integer} instance    plot instance (sequence) number
 * @param {Object} template     Default trace property values
 * @param {Array} logable       string component ids available to log events for
 * @return {Array of Object}
 */
buildPlotData = function (instance, template, logable) {
  var data, traceSource, i, trace;
  data = [];
  plotBlock[instance].streams = [];
  traceSource = config.plots[i].plotData;
  for (i = 0; i < traceSource.length; i += 1) {
    // Copy the trace configuration information and merge with the template
    trace = JSON.parse(JSON.stringify(traceSource[i]));
    trace.extend(template);
    if (!logable.includes(trace.component)) {
      console.log('Plot', instance + ', trace', i + ': component',
        trace.component, 'events are not logable');
      // throw new Error('')
    }
    if (trace.name === undefined) {
      trace.name = trace.component;// Default trace name, when not specified
    }
    data.push(trace);// Save the data needed to configure the plot

    // Save the data needed to identify events to record, and to add them to
    // the plot trace
    plotBlock[instance].stream[i] = {
      component: trace.component,
      name: trace.name,
      token: trace.stream.token,
      transform: trace.transform
    };
  }
  return data;
};

/**
 * Continue processing when plot.ly has finished setting up the plot.
 *
 * @private
 * @param {Object} err      error object
 * @param {Object} msg      plot creation details object
 * @return {undefined}
 */
plotlyCommunicationEstablished = function (instance, total, callback, err, msg) {
  var block, trace;//, traces;
  console.log(nowString(), 'start plotlyCommunicationEstablished for instance',
    instance);//trace
  if (!isPlotReady(err, msg)) {
    throw new Error(
      'Failed to complete Plotly Streaming API setup for plot' + instance
    );
  }

  block = plotBlock[instance];
  // Examples: https://github.com/plotly/plotly-nodejs (search for plotly.stream)
  for (trace = 0; trace < block.stream.length; trace += 1) {
    block.stream[trace].stream = block.plotly.stream(block.stream.token,
      streamFinished);
  }
  if (plotlyInstanceReady.includes(instance)) {
    throw new Error('Plot ' + instance +
      ' communications callback encountered twice');
  }
  plotlyInstanceReady.push(instance);
  console.log('plotly instance', instance, 'ready');//trace

  if (plotlyInstanceReady.length >= total) {
    // When ALL plots have established communications, which could happen
    // out of order
    process.nextTick(callback);
    console.log('\nplotly data logging setup\n');// report
  }
};// ./function plotlyCommunicationEstablished(instance, total, callback, err,msg)

/**
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
 * Add listeners for data events for a single sensor
 *
 * @param {object} component    johnny-five component instance
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
  //IDEA: check configuration information before picking event(s) to listen to
  component.addListener('data', recordAllData);
  component.addListener('change', recordDataChange);
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
  // Save reference to board, not just (boolean) that it has been seen
  loggedBoards[emitter.id] = emitter;
  emitter.addListener('stateChange', recordStateChange);
}

/**
 * Check that all needed information has been provided to log the configured
 * information
 *
 * With the current configuration information, there is not really enough detail
 * to tell if everything has been supplied.  Control component state change
 * events are handled generically.  Sensor components require individual calls
 * to configure logging, but the configuration data does not show which
 * component ids are sensors.  Only which trace to associated with each
 * component id, which could be either sensor or control.
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
  loggedBoards[boardIds[0]].loop(plotlyHeartRate, doHeartbeat);

  setupComplete = true;
}

module.exports = {
  init: initializePlotly,
  addSensor: addSensorEventHandler,
  addBoard: addControlEventHandler,
  finalize: finalizePlotlySetup
};
