'use strict';

// Collect the needed external pieces
var five = require('johnny-five');
var Plotly = require('plotly');
var user = require('./.private/userinfo.js');
var config = require('./controlcfg.js');

// file/module scope variables
var board, plotly, waitingQueue;
var counter;//DEBUG
function nowString() { return new Date().toISOString(); }
console.log(nowString(), 'modules loaded:');//trace

waitingQueue = [];
counter = 0;//DEBUG


///////////////////////
// Utility functions //
///////////////////////

// Only needs refresh twice a year, to handle daylight savings time changes
var tzOffset = new Date().getTimezoneOffset() * 60000;// milliseconds from GMT
/***
 * get a time value for the local (server) timezone
 *
 * @return {unsigned long}
 */
function localDate() {
  return new Date() - tzOffset;
}// ./function localDate()

/***
 * Create a formatted (for plotly) date string from the current local time
 *
 * @param {data type} parmeter name parameter description
 * @return {string}
 */
function getDateString() {
  return new Date(localDate()).toISOString().replace('T', ' ').substr(0, 23);
}// ./function getDateString()

/***
 * emulate Arduino delay function
 *
 * Full blocking 'busy' wait
 * NOTE: if the delay value starts approaching the heartbeat rate, this will
 * need to be change to send heartbeats while waiting.
 *
 * @param {unsigned lone} millis milliseconds to wait
 * @return {undefined}
 */
function delay(millis) {
  var date, curDate;
  date = new Date();
  curDate = null;
  do {
    curDate = new Date();
  } while (curDate - date < millis);
}// ./function delay(millis)


//////////////////////////////////////////////////////////////
// helper functions for the many event processing functions //
//////////////////////////////////////////////////////////////

/***
 * Set the whole system state to 'all off'
 *
 * @param {Array of Object} sensors  The sensors that have the control objects
 * @return {undefined}
 */
function allClosedOff(sensors) {
  var i;
  for (i = 0; i < sensors.length; i += 1) {
    sensors[i].context.valve.close();
    delay(config.controller.hardwareDelay);// Wait before closing next solenoid
  }

  sensors[0].context.pump.open();// Pump off when relay is open
  delay(config.controller.hardwareDelay);// Wait before next (possible) change
}// ./function allClosedOff()

/***
 * Activate the controls to bring the conditions back to the 'good' range.
 *
 * @param {object} sensor    Sensor object with linked controls
 * @return {undefined}
 */
function correctConditions(sensor) {
  sensor.context.valve.open();// Open the valve
  delay(config.controller.hardwareDelay);
  sensor.context.pump.close();// turn the pump on

  delay(config.controller.flowTime);// Wait for some water to flow

  sensor.context.valve.close();// Close the valve
  delay(config.controller.hardwareDelay);
  sensor.context.pump.open();// turn the pump off
  delay(config.controller.hardwareDelay);
}// ./function correctConditions(sensor)

/***
 * Send a single data point to the stream configured for a control set
 *
 * @param {object} sensor     controlling sensor information
 * @param {array} state       The trace values for the state
 * @param {string} time       The time value for the data point
 * @return {object}
 */
function sendTracePoint(sensor, state, time) {
  var data = {
    x: time,
    y: state[sensor.context.index]
  };
  sensor.context.stream.write(JSON.stringify(data) + '\n');
  // Make sure do not get multiple points sent too close together.  Probably
  // not needed, since documentation says there is some buffering.  Should never
  // be more than 4 data points in close succesion, and the (plotly server)
  // buffer should be able to handle that much.
  delay(config.plotly.throttleTime);
  //consoleLogger(counter, set.index, data);//Debug (single refernce)
  return data;
}// ./function sendTracePoint(sensor, state, time)


////////////////////////////////////////////////////////////////////////////
// The callback functions that do the actual work of reading the sensors, //
// contolling the pump and valves, logging events to plotly traces        //
////////////////////////////////////////////////////////////////////////////

/***
 * Send heart beat / keep alive signal to each plotly stream
 *
 * @return {undefined}
 */
function doHeartbeat() {
  /* jshint validthis: true */
  var i, nTraces;
  console.log(nowString(), 'heartbeat');//trace
  nTraces = this.length;
  // console.log('match traces count:',//DEBUG
  //   config.controller.nTraces === nTraces
  //   );//Debug
  for (i = 0; i < nTraces; i += 1) {
    this[i].context.stream.write('\n');
    // data point throttling is for json.  No JSON here, so should not need to
    // insert any artificial delay.
  }
}// .//function doHeartbeat

/***
 * Do any sensor value based processing.
 *
 * callback function for repeating (timed) sensor reads
 * Water area when sensor shows it to be too dry
 *
 * Stream data to plotly, logging watering events
 *
 * @return {undefined}
 */
function controlMoisture() {
  /* jshint validthis: true */
  var data;
  console.log(nowString(), 'controlMoisture for', this.id);//trace

  // NOTE: current testing says queueing is not really needed.  Despite the event
  // 'model' being used, all events are sequential: processing of a received
  // event completes before the next callback is started, though they were
  // 'triggered' at the same time.
  // Guessing that the library is walking a loop, and doing 'callback' when
  // conditions match.  The callback function has to return before the next
  // event can get checked for.
  waitingQueue.push(this.id);
  if (waitingQueue.length !== 1) {//DEBUG
    console.log(nowString(), 'Current queue length:', waitingQueue.length);//DEBUG
  }//DEBUG
  while (waitingQueue[0] !== this.id) {
    // Some other sensor is processing
    delay(config.controller.flowTime);
    console.log(nowString(), 'delayed checking for', this.id);//trace
  }

  // Always send an 'off' data point at the start of processing.  That will be
  // the only point logged, unless watering is needed.
  data = sendTracePoint(this, config.controller.off, getDateString());
  if (this.boolean === false) {
    // Too Dry
    // Mark the trace to show when the watering starts and stops
    data = sendTracePoint(this, config.controller.on, data.x);
    correctConditions(this);
    data = sendTracePoint(this, config.controller.on, getDateString());
    data = sendTracePoint(this, config.controller.off, data.x);
  }

  // Close valves and turn pump off
  // redundant, because the valves should already be closed and pump off
  allClosedOff(this.board.traceSensors);

  counter += 1;//DEBUG
  // Remove (just) finished index from the queue
  data = waitingQueue.shift();
  if (data !== this.id) {
    console.log('Logic error: current process was for', this.id,
      'but queue said', data);
  }
}// ./function controlMoisture()


///////////////////////////////////////
// configuration and setup functions //
///////////////////////////////////////

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

/***
 * Check and report the information supplied to the callback function when
 * a streaming plot configuration was reqested
 *
 * @param {Object} err      error object
 * @param {Object} msg      successful plot creation details
 * @return {undefined}
 */
function verifyPlotInitialization(err, msg) {
  console.log(nowString(), 'start verifyPlotInitialization');//trace
  if (err) {
    // Just report the problem and exit, could not initialize plotly
    console.log('Failed to initialize Plotly plot');//report
    console.log(err);//report
    process.exit();
    return;
  }

  // Plot initialization succeeded.
  // console.log(nowString(), 'Msg:', msg);//DEBUG
  if (msg.streamstatus !== config.plotly.messages.multipleStreams) {
    console.log('Unexpected graph stream status.');//report
    console.log('Are there really multiple traces configured?');//report
    console.log('Expected:', config.plotly.messages.multipleStreams);//report
    console.log('Actual:  ', msg.streamstatus);//report
    process.exit();
  }
  console.log('\nPlot being created at:', msg.url, '\n');//report
}// ./function verifyPlotInitialization(err, msg)

/***
 * Link devices on the slaved controller with the processing methods
 *
 * Callback function, executed when the plot used for logging has finished
 * initialization
 *
 * @param {Object} err      error object
 * @param {Object} msg      successful plot creation details
 * @return {undefined}
 */
function initializeLocal(err, msg) {
  /* jshint validthis: false */
  var pump, trace, mSns;
  console.log(nowString(), 'start initializeLocal');//trace
  // console.log('this:', this);//undefined//DEBUG
  verifyPlotInitialization(err, msg);

  // Streaming plot ready to attach trace streams to.

  // initialize the pump: used with any/all of the control valves
  // This is a motor, but without any direction or speed control.  It can only
  // be turned on and off.  A Relay give about the right control semantics.
  // console.log('pump config:', config.controller.pumpConfig);//DEBUG
  pump = new five.Relay(config.controller.pumpConfig);
  console.log(nowString(), 'pump initialized');//trace
  // console.log(pump.board.id);//DEBUG
  // pump (and all johnny-five device instances) contain a board property that
  // references the board instance that are created for.
  // console.log('Pump instance', pump);//DEBUG

  // initialize a dummy input, and use (sensor) reads on it to trigger a
  // heartbeat for the streaming data.
  // console.log(nowString(), 'heart config',
  //   config.controller.heartbeatConfig
  //   );//DEBUG
  // heartbeat = new five.Sensor(config.controller.heartbeatConfig);
  // heartbeat.sensors = [];
  board.traceSensors = [];

  // Each trace is associated with a valve, which is opened and closed based on
  // sensor readings.  One sensor per valve.  Link the pieces up, so that the
  // processing for the sensor readings can access all of the other associated
  // hardware and data logging channels.
  for (trace = 0; trace < config.controller.nTraces; trace += 1) {
    mSns = new five.Sensor(config.sensorConfig(trace));
    //console.log(nowString(), 'sensor[' + trace + ']', mSns);//DEBUG
    // console.log(nowString(), 'booleanAt', mSns.booleanAt);//Debug
    // console.log(nowString(), 'barrier', mSns.booleanBarrier);//undefined//Debug
    mSns.booleanAt(config.controller.tooDryValue);
    // console.log(nowString(), 'barrier', mSns.booleanBarrier);//undefined//Debug
    // console.log(nowString(), 'boolean', mSns.boolean);//Debug
    // Add information to the context for the sensor that will provide access to
    // the objected need when processing the sensor data.
    //   - control for the valve
    //   - control for the pump motor
    //   - stream for the graphical event logging
    //   - the trace number
    //   - heartbeat (to indirectly access other sensor trace streams)
    mSns.context = {
      index: trace,
      pump: pump,
      valve: new five.Relay(config.valveConfig(trace)),
      stream: plotly.stream(user.tokens[trace], streamFinished)//,
      // heartbeat: heartbeat
    };
    // Add the sensor the heart beat processing list
    board.traceSensors.push(mSns);

    // Setup a function to read and process sensor data regularly
    mSns.on('data', controlMoisture);
  }

  // pump.board.repl.inject({pump: pump});//DEBUG
  // pump.board.repl.inject({sensor1: mSns});//DEBUG
  board.loop(config.controller.heartRate, doHeartbeat.bind(board.traceSensors));
  // heartbeat.on('data', doHeartbeat);
  console.log(nowString(), 'heartbeat processing intialized\n');//trace

  // All further processing for the application is going to be done in the
  // callbacks for the just configure sensor reads
  console.log(nowString(), 'all setup done: start processing via callbacks\n');
}// ./function initializeLocal(err, msg)

/***
 * Initialize the remote resources needed for logging inforamtion about the
 * control events.
 *
 * Callback function, executed when the slaved board is ready.  This is called
 * in the (this) context of the board instance.  That instance has been
 * populated with a lot of extra information, both generic and specific to the
 * slaved board.
 *
 * @return {undefined}
 */
function initializeRemote() {
  /* jshint validthis: true */
  console.log(nowString(), 'start initializeRemote');//trace
  // console.log(this === board);//true//DEBUG
  // console.log('this:', this);//DEBUG

  // The control board is ready.  Setup the remote logging object.

  // var data = config.buildPlotData(user.tokens);//DEBUG
  // console.log(nowString(), 'plot data:', data);//DEBUG
  // console.log(nowString(), 'plot options:', config.plotly.graphOptions);//DEBUG
  plotly.plot(
    config.buildPlotData(user.tokens),
    config.plotly.graphOptions,
    initializeLocal
  );
  console.log(nowString(), 'plotly callback configured');//trace
}// ./function initializeRemote()


// console.log('Five:', five);//DEBUG
// console.log('Plotly constructor:', Plotly);//DEBUG
// console.log('User:', user);//DEBUG

plotly = new Plotly(user.userName, user.apiKey);
board = new five.Board();
board.id = 'Water Controller board';
board.repl = false;
// console.log('Plotly instance:', plotly);//DEBUG
// console.log('User:', user);//DEBUG
// console.log('Config:', config);//DEBUG
// console.log('Board:', board);//DEBUG

board.on('ready', initializeRemote);
console.log(nowString(), 'board ready callback configured');//trace
