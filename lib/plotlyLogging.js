'use strict';

/* Handle all communitions with the Plot.ly api.  This includes setup, and any
   data stream logging.
 */

var Plotly = require('plotly');
var plot, plotdata, plotTraces;
var multipleStreams = 'All Streams Go!';
var plotlyHeartRate = 30000;  // once every 30 seconds: Limit is 1 minute
var user = require('../.private/userinfo.js');
var config = require('../controlcfg.js');
// throttleTime: 100 // milliseconds
plotTraces = [];

function nowString() { return new Date().toISOString(); }//DEBUG

// Only needs refresh twice a year, to handle daylight savings time changes
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

/***
 * Initialize communications with the plot.ly data streaming api
 *
 * @param {Function} callback     function to execute when data logging us readt
 * @return {undefined}
 */
function initializePlotly(callback) {
  console.log(nowString(), 'start initialize Plotly');//trace
  // Store the instance in a module level variable, where (only) other functions
  // in this module can access it.
  // console.log('Plotly constructor:', Plotly);//DEBUG
  // console.log('User:', user);//DEBUG
  plot = new Plotly(user.userName, user.apiKey);
  // console.log('Plotly instance:', plotly);//DEBUG

  // Store the plot data as well.  It contains the tokens that will be needed
  // to stream data points
  // TODO: move config.buildPlotData to here: plotly specific function
  plotdata = config.buildPlotData(user.tokens);
  // console.log(nowString(), 'plot data:', plotdata);//DEBUG
  // console.log(nowString(), 'plot options:', config.plotly.graphOptions);//DEBUG

  plot.plot(
    plotdata,
    config.plotly.graphOptions,
    callback
  );
  console.log(nowString(), 'plotly callback configured');//trace
}

/***user.
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
  console.log('trace', this, 'data:', xValue, yValue);//DEBUG
  plotTraces[this].write(JSON.stringify({
    x: xValue,
    y: yValue
  }) + '\n');
}

function addTracePoint(trace, time, yValue) {
  // console.log(nowString(), 'start addTracePoint');//trace
  // 'emit' the remote data logging request, so that failures (hopefully) do not
  // affect the actual processing
  process.nextTick(streamDataPoint.bind(trace, getDateString(time), yValue));
}

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

function newTrace(trace) {
  console.log(nowString(), 'start newTrace:', trace);//trace
  // Create trace stream, and save it (in the module) later processing.
  plotTraces[trace] = plot.stream(plotdata[trace].stream.token, streamFinished);
}

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
    } else {//DEBUG
      console.log('found inherited property:', p);//DEBUG
    }
  }
}

/***
 * Check and report the information supplied to the callback function when
 * a streaming plot configuration was reqested
 *
 * @param {Object} err      error object
 * @param {Object} msg      plot creation details object
 * @return {boolean}
 */
function verifyPlotInitialization(err, msg) {
  console.log(nowString(), 'start verifyPlotInitialization');//trace
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
    // console.log('err object');//DEBUG
    // reportObjectContents(err);//DEBUG
    reportObjectContents(err.body);

    // console.log('full JSON');//DEBUG
    // console.log(JSON.stringify(err, ' '));//DEBUG
    // console.log(err);//DEBUG
    return false;
  }

  // Plot initialization succeeded.
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
}// ./function verifyPlotInitialization(err, msg)

/**
 * Send heart beat / keep alive signal to each plotly stream
 *
 * @return {undefined}
 */
function doHeartbeat() {
  /* jshint validthis: false */
  var i, nTraces;
  console.log(nowString(), 'heartbeat');//trace
  nTraces = plotTraces.length;
  for (i = 0; i < nTraces; i += 1) {
    plotTraces[i].write('\n');
    // data point throttling is for json.  No JSON here, so should not need to
    // insert any artificial delay.
  }
}// .//function doHeartbeat

function startHearbeat(board) {
  console.log(nowString(), 'start heartbeat');//trace
  board.loop(plotlyHeartRate, doHeartbeat.bind(board));
}

module.exports = {
  init: initializePlotly,
  verifyInitialization: verifyPlotInitialization,
  newTrace: newTrace,
  addTracePoint: addTracePoint,
  startTraces: startHearbeat
};
