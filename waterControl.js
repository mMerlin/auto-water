'use strict';

// predeclare variables to hold functions, to avoid used before declared issues
var initializeDataLogging, initializeMonitoring, checkSensor, processNextSensor,
  primePump, activateControl, endCorrection, endPumping;

// Collect the needed external pieces
var five = require('johnny-five');
var config = require('./controlcfg.js');
var dataLog = require('./lib/plotlyLogging.js');

// file/module scope variables
var board, waitingQueue;
function nowString() { return new Date().toISOString(); }//DEBUG
console.log(nowString(), 'modules loaded:');//trace

// IDEA: The queue could potentially cover sensors across multiple boards
// potentially with multiple pumps, potentially with the pump, sensor, and valve
// all on different boards.
// Think about managing hardware activation delays across boards: should delays
// apply only within a single board, or is this (partly) a power concern accorss
// the whole system?
waitingQueue = [];


/**
 * Check to see if a specific sensor is already in the 'waiting to process'
 * queue.
 *
 * Uses module scope {Array} waitingQueue for input
 *
 * no 'this' parameter for run context
 *
 * @param {Sensor} controlSensor      Process controlling sensor instance
 * @return {boolean}
 */
function isQueuedSensor(sensor) {
  /* jshint validthis: false */
  var i, queueLen, j;//DEBUG j
  queueLen = waitingQueue.length;// ASSERT
  for (i = 0; i < queueLen; i += 1) {// ASSERT
    if (sensor === waitingQueue[i]) {// directly compare object instances
      console.log('Duplicate sensor processing detected; ignoring second');//trace
      console.log('Currently Queued:');//DEBUG
      for (j = 0; j < queueLen; j += 1) {//DEBUG
        console.log(waitingQueue[j].id, 'on', waitingQueue[j].board.id,
          'for trace', waitingQueue[j].context.index);//DEBUG
      }//DEBUG
      console.log('duplicate', sensor.id, 'for trace',
        sensor.context.index);//DEBUG
      return true;// This sensor is already already in the list to be processed
    }
  }
  return false;
}

function dequeueSensor(sensor) {
  /* jshint validthis: true */
  var first = waitingQueue.shift();
  if (first !== sensor) {// directly compare object instances
    console.log('Logic error: current process was for trace', sensor.id,
      'but queue said', first.id);//DEBUG
    //'on ', sensor.board.id,
  }//DEBUG

  console.log(nowString(), 'hardware delay', config.controller.hardwareDelay,
    'before processNextSensor');//DEBUG
  sensor.board.wait(config.controller.hardwareDelay, processNextSensor);
  console.log(nowString(), 'schedule processing for next sensor in the queue');
}


/**
 * Initialize the resources needed for logging information about the
 * control events.
 *
 * Callback function, executed when the slaved board is ready.
 * IDEA: need to rethink call chain if have multiple boards
 *
 * 'this' === board
 *
 * @return {undefined}
 */
initializeDataLogging = function () {
  /* jshint validthis: true */
  console.log(nowString(), 'start initializeDataLogging');//trace

  // The control board is ready.  Setup the remote logging object.

  dataLog.init(initializeMonitoring);
  console.log(nowString(), 'data logging configured');//trace
};// ./function initializeDataLogging()

// Helper functions just to improve the semantics in the main code

function turnPumpOffAfter(pump, waitTime) {
  pump.board.wait(waitTime, pump.off.bind(pump));// = copen() for Nomally Open
}
function closeValveAfter(valve, waitTime) {
  valve.board.wait(waitTime, valve.close.bind(valve));// = on() for NClosed
}
function getBoolean() {
  /* jshint validthis: true */
  return this.boolean;
}

/**
 * Link devices on the slaved controller with the processing methods
 *
 * Callback function, executed when the plot used for logging has finished
 * initialization
 *
 * no 'this' context
 *
 * @param {Object} err      error object
 * @param {Object} msg      successful plot creation details
 * @return {undefined}
 */
initializeMonitoring = function (err, msg) {
  /* jshint validthis: false */
  console.log(nowString(), 'start initializeMonitoring');//trace
  var pump, trace, mSns, initDelay;
  initDelay = 0;

  // Function arguments are from the initialization of the dataLog (callback).
  // Let it do any needed verification.
  if (!dataLog.verifyInitialization(err, msg)) {
    console.log('remote initialization failed');//report
    process.exit();
  }

  // logging system is ready to attach trace streams to.

  // initialize the pump: used with any/all of the control valves
  // This is a motor, but without any direction or speed control.  It can only
  // be turned on and off.  A Relay gives about the right control semantics.
  // console.log('pump config:', config.controller.pumpConfig);//DEBUG
  pump = new five.Relay(config.controller.pumpConfig);
  console.log(nowString(), 'pump initialized');//trace
  initDelay += config.controller.hardwareDelay;
  // board.wait(initDelay, runFunction.bind(pump, 'open', "stop pump"));
  // board.wait(initDelay, pump.close.bind(pump));
  turnPumpOffAfter(pump, initDelay);
  // console.log(pump.board.id);//DEBUG
  // pump (and all johnny-five device instances) contain a board property that
  // references the board instance that are created for.

  // Each trace is associated with a valve, which is opened and closed based on
  // sensor readings.  One sensor per valve.  Link the pieces up, so that the
  // processing for the sensor readings can access all of the other associated
  // hardware and data logging channels.
  for (trace = 0; trace < config.controller.nTraces; trace += 1) {
    mSns = new five.Sensor(config.sensorConfig(trace));
    // Setup a limit, for direct out of range boolean checks
    mSns.booleanAt(config.controller.tooDryValue);
    // No going to full inheritance of Sensor, but adding an alias to the local
    // instances, to provide better semantics.
    Object.defineProperties(mSns, {
      isInRange: {
        get: getBoolean
      }
    });
    // Add information to the context for the sensor that will provide access to
    // the objects need when processing the sensor data.
    //   - the trace number
    //   - control for the valve
    //   - control for the pump motor
    // console.log(config.valveConfig(trace));//DEBUG
    mSns.context = {
      index: trace,
      pump: pump,
      valve: new five.Relay(config.valveConfig(trace))
    };
    initDelay += config.controller.hardwareDelay;
    // board.wait(initDelay, runFunction.bind(mSns.context.valve, 'close',
    //   'close valve ' + trace));
    closeValveAfter(mSns.context.valve, initDelay);
    // console.log(mSns.context.valve);//DEBUG
    dataLog.newTrace(trace);

    // Schedule callbacks to regularly process data for this sensor
    mSns.on('data', checkSensor.bind(mSns));
    // mSns.on('data', checkSensor.bind(mSns));//DEBUG deliberate duplicate
  }

  // All traces used for data logging have been created.  Let the logging
  // system know to start processing them.
  dataLog.startTraces(pump.board);

  // All further processing for the application is going to be done in the
  // callbacks for the just configure sensor reads
  console.log(nowString(),
    '\nall setup done: start processing via sensor data event callbacks\n'
    );//trace
};// ./function initializeMonitoring(err, msg)


////////////////////////////////////////////////////////////////////////////
// The callback functions that do the actual work of reading the sensors, //
// contolling the pump and valves, logging events                         //
////////////////////////////////////////////////////////////////////////////

/**
 * Add the sensor to the queue to be processed now/soon
 *
 * 'data' event handler for sensors
 *
 * 'this' is one of the process controlling sensor instances
 *
 * @return {undefined}
 */
checkSensor = function () {
  /* jshint validthis: true */
  console.log(nowString(), 'start checkSensor for', this.id, 'trace',
    this.context.index);//trace

  // Make sure that the current sensor only gets queued once (per batch)
  if (isQueuedSensor(this)) { return; }

  waitingQueue.push(this);

  if (waitingQueue.length === 1) {
    // Queue was empty: start processing it (again)
    process.nextTick(processNextSensor);
    console.log(nowString(), 'starting sensor queue processing');
  } else {//DEBUG
    console.log(nowString(), 'Current queue length:', waitingQueue.length);//DEBUG
  }
};// ./function checkSensor()

/***
 * Start processing for sensor at the top/head of the queue
 *
 * no 'this' context
 *
 * @return {undefined}
 */
processNextSensor = function () {
  /* jshint validthis: false */
  var controllingSensor, trace, startTime, offValue;
  if (waitingQueue.length <= 0) {
    // Nothing left to process
    console.log(nowString(), 'sensor queue is empty: going back to sleep');//trace
    return;
  }

  // Get the sensor from the head of the queue
  controllingSensor = waitingQueue[0];
  console.log(nowString(), 'process sensor "' + controllingSensor.id + '" on',
    controllingSensor.board.id);//trace

  // Always send an 'off' data point at the start of processing for a sensor.
  // That will be the only point logged, unless the sensor shows out of range.
  trace = controllingSensor.context.index;
  // console.log(nowString(), 'for trace', trace);//Debug
  offValue = config.controller.off[trace];
  startTime = new Date();
  dataLog.addTracePoint(trace, startTime, offValue);

  // if (controllingSensor.boolean)
  if (controllingSensor.isInRange) {
    // In range: no processing needed for this sensor: remove it from the queue
    dequeueSensor(controllingSensor);
    return;
  }

  // Out of acceptable range; start the corrective action processing
  console.log(nowString(), 'start corrective action for',
    controllingSensor.id);//trace
  console.log(nowString(), 'hardware delay', config.controller.hardwareDelay,
    'before primePump');//DEBUG
  controllingSensor.board.wait(config.controller.hardwareDelay,
    primePump.bind(controllingSensor, startTime));
};

primePump = function (startTime) {
  /* jshint validthis: true */
  var trace;
  console.log(nowString(), 'start activateControl');
  trace = this.context.index;

  // Mark the trace to show when corrective action starts
  dataLog.addTracePoint(trace, startTime, config.controller.on[trace]);

  this.context.pump.close();// turn the pump on
  // open the value after a short delay
  console.log(nowString(), 'hardware delay', config.controller.hardwareDelay,
    'before controllingSensor');//DEBUG
  this.board.wait(config.controller.hardwareDelay, activateControl.bind(this));
};

// Time sequenced callback chain: 'this' is the controlling sensor
activateControl = function () {
  /* jshint validthis: true */
  console.log(nowString(), 'start activateControl');
  this.context.valve.open();// Open the valve, start corrective processing
  // Wait for awhile, and stop the corrective action
  console.log(nowString(), 'flowTime', config.controller.flowTime,
    'before endCorrection');//DEBUG
  this.board.wait(config.controller.flowTime, endCorrection.bind(this));
};

endCorrection = function () {
  /* jshint validthis: true */
  console.log(nowString(), 'start endCorrection');
  this.context.valve.close();// Close the value, end corrective processing
  // turn off the pump after a short delay
  console.log(nowString(), 'hardware delay', config.controller.hardwareDelay,
    'before endPumping');//DEBUG
  this.board.wait(config.controller.hardwareDelay, endPumping.bind(this));
  // Exit this (callback) function, and continue with endPumping after delay
};

endPumping = function () {
  /* jshint validthis: true */
  console.log(nowString(), 'start endPumping');
  var endTime, trace, onValue, offValue;
  this.context.pump.open();// turn the pump off

  // Mark the end of corrective processing on the trace
  endTime = new Date();
  trace = this.context.index;
  onValue = config.controller.on[trace];
  offValue = config.controller.off[trace];
  dataLog.addTracePoint(trace, endTime, onValue);
  dataLog.addTracePoint(trace, endTime, offValue);

  // Remove the (just) finished sensor from the queue
  dequeueSensor(this);
  // End of timed callback chain started from processNextSensor
};

board = new five.Board();
board.id = 'Water Controller board';
board.repl = false;

board.on('ready', initializeDataLogging);
console.log(nowString(), 'board ready callback configured');//trace
