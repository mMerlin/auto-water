'use strict';

// predeclare variables to hold functions, to avoid used before declared issues
var initializeDataLogging, initializeMonitoring, checkSensor, processNextSensor;

// Collect the needed external pieces
var five = require('johnny-five');
var config = require('./controlcfg.js');
var dataLog = require('./lib/plotlyLogging.js');

// file/module scope variables
function nowString() { return new Date().toISOString(); }//DEBUG
var board, waitingQueue, queueIsProcessing, sensorIsProcessing;
console.log(nowString(), 'modules loaded:');//trace

// IDEA: The queue could potentially cover sensors across multiple boards
// potentially with multiple pumps, potentially with the pump, sensor, and valve
// all on different boards.
// Think about managing hardware activation delays across boards: should delays
// apply only within a single board, or is this (partly) a power concern accorss
// the whole system?
waitingQueue = [];
// Semaphore flags
queueIsProcessing = false;
sensorIsProcessing = false;


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
  sensorIsProcessing = false;
  if (waitingQueue.length < 1) {
    console.log('no entry in the queue: overlapping processing error');
    return;
  }
  var first = waitingQueue.shift();
  if (first !== sensor) {// directly compare object instances
    if (typeof first !== 'object') {
      console.log('Queue entry is not an object: processing error');
      return;
    }
    console.log('Logic error: current process was for trace', sensor.id,
      'but queue said', first.id);//DEBUG
    //'on ', sensor.board.id,
    return;
  }//DEBUG

  if (waitingQueue.length > 0) {
    console.log(nowString(), 'dequeue: queue processNextSensor@nextTick for',
      waitingQueue[0].id);
    process.nextTick(processNextSensor);
  } else {
    // Nothing left in the queue to process
    console.log(nowString(), 'sensor queue is empty: going back to sleep');//trace
    queueIsProcessing = false;
  }
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
  pump.board.wait(waitTime, pump.off.bind(pump));// = open() for Nomally Open
}
function turnPumpOnAfter(pump, waitTime) {
  //process.nextTick(pump.on.bind(pump));// If waitTinme <= 0
  pump.board.wait(waitTime, pump.on.bind(pump));// = close() for Nomally Open
}
function closeValveAfter(valve, waitTime) {
  valve.board.wait(waitTime, valve.close.bind(valve));// = on() for NClosed
}
function openValveAfter(valve, waitTime) {
  valve.board.wait(waitTime, valve.open.bind(valve));// = off() for NClosed
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
  if (isQueuedSensor(this)) {//ASSERT
    console.log('Sensor', this.id, 'already queue: extra ignored');//DEBUG
    return;
  }

  waitingQueue.push(this);

  if (!queueIsProcessing) {
    // [re]start the queue processing
    queueIsProcessing = true;
    console.log(nowString(), 'checkSensor: queue processNextSensor@nextTick for',
      waitingQueue[0].id);
    process.nextTick(processNextSensor);
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
  var curSensor, snsBoard, trace, offValue, onValue,
    baseTime, startTime, endTime, delayTime;

  // Abort duplicate processing, if it manages to get started
  if (sensorIsProcessing) {
    console.log('\nDuplicate sensor processing detected: dropping duplicate\n');
    return;
  }
  sensorIsProcessing = true;


  // Get the sensor from the head of the queue
  curSensor = waitingQueue[0];
  snsBoard = curSensor.board;
  console.log(nowString(), 'process sensor "' + curSensor.id + '" on',
    snsBoard.id);//trace

  // Always send an 'off' data point at the start of processing for a sensor.
  // That will be the only point logged, unless the sensor shows out of range.
  trace = curSensor.context.index;
  // console.log(nowString(), 'for trace', trace);//Debug
  offValue = config.controller.off[trace];
  onValue = config.controller.on[trace];

  if (curSensor.isInRange) {
    // In range: no processing needed for this sensor: remove it from the queue
    console.log('in range dequeue check: current/head =', curSensor.id,
      '/', waitingQueue[0].id);//DEBUG
    startTime = new Date();
    dataLog.addTracePoint(trace, startTime, offValue);
    dequeueSensor(curSensor);
    return;
  }

  // Out of acceptable range; start the corrective action processing
  console.log(nowString(), 'start corrective action for',
    curSensor.id);//trace
  // Mark the trace to show when corrective action starts
  baseTime = new Date().valueOf();
  delayTime = 0;// dequeueSensor is delayed enough not to need more here
  turnPumpOnAfter(curSensor.context.pump, delayTime);
  delayTime += config.controller.hardwareDelay;// 1 Second

  startTime = baseTime + delayTime;
  openValveAfter(curSensor.context.valve, delayTime);
  delayTime += config.controller.flowTime;// 10 Seconds

  endTime = baseTime + delayTime;
  closeValveAfter(curSensor.context.valve, delayTime);
  delayTime += config.controller.hardwareDelay;// 1 Second

  turnPumpOffAfter(curSensor.context.pump, delayTime);
  delayTime += config.controller.hardwareDelay;// 1 Second

  // Should queue this data logging, so it does not run until (just) after
  // dequue.  Or at least after turnPumpOff.  Safety so that any crash
  // during datalogging can only occur while the valves and pump are off.
  // Variant: send the first 2 points before starting the pump, so the trace
  // will provide a (remote) clue that something locked up.
  dataLog.addTracePoint(trace, startTime, offValue);
  dataLog.addTracePoint(trace, startTime, onValue);
  dataLog.addTracePoint(trace, endTime, onValue);
  dataLog.addTracePoint(trace, endTime, offValue);

  // Remove the sensor from the queue AFTER processing is finished for it
  snsBoard.wait(delayTime, dequeueSensor.bind(null, curSensor));
};

board = new five.Board();
board.id = 'Water Controller board';
board.repl = false;

board.on('ready', initializeDataLogging);
console.log(nowString(), 'board ready callback configured');//trace
