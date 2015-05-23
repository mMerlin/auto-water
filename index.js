/*
 * water-load
 * https://github.com/mMerlin/water-load
 *
 * Copyright (c) 2015 H. Phil Duby
 * Licensed under the MIT license.
 */

'use strict';
var events, five, jLoad, datalog, topConfig, config, correctionInProgress,
  modelDescription,
  block;

events = require('events');//IDEA: is event ever directly used?
five = require('johnny-five');
jLoad = require('johnny-load');
topConfig = require('./.private/userinfo.js');
config = topConfig.process;
// Load the configured datalogging module
datalog = require(topConfig.logging.activeModule);

block = {};
block.lastCmdTime = 0;// Far in the past

// function nowString() { return new Date().toISOString(); }//DEBUG

// Setup the strucutue to use for a sensor plus associated process correction
// controls.
block.baseSensorSet = {
  sensor : {
    class: "Sensor",
    options: {
      freq: config.sensorPeriod
    },
    lastProcessed: block.lastCmdTime,
    usage: "measurement",
    setup: { booleanAt: config.dryLimit },
    children: {
      valve: {
        class: "Relay",
        options: {
          type: "NC"
        },
        children: {
          include: "pressure pump"
        },
        lastProcessed: block.lastCmdTime,
        usage: "correction",
        setup: "off",
        adjustTime: config.flowTime,
        adjustDelay: config.blockTime
      }
    }
  }
};
modelDescription = {
  pump: {
    class: "Relay",
    options: {
      type: "NO"
    },
    label: "pressure pump",
    lastProcessed: block.lastCmdTime,
    usage: "pressurize",
    setup: "off",
    warmup: config.pumpWarmup,
    cooldown: config.pumpCooldown
  }
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
 * Add a new sensor to the model description, as a clone of the base sensor,
 * filling information from configuration file
 *
 * 'this' is the model description object to add the cloned sensor to
 *
 * @param {Array} pinArray        Sensor set information
 * @param {Number} sensorNum      Index into sensorPinSet Array (forEach param)
 * @return {undefined}
 */
function cloneSensor(pinArray, sensorNum) {
  /* jshint validthis:true */
  var newSensor, properties;

  newSensor = JSON.parse(JSON.stringify(block.baseSensorSet.sensor));

  properties = Object.keys(pinArray[0]);
  newSensor.options.pin = properties[0];
  newSensor.options.id = pinArray[0][properties[0]];
  properties = Object.keys(pinArray[1]);
  newSensor.children.valve.options.pin = properties[0];
  newSensor.children.valve.options.id = pinArray[1][properties[0]];

  if (block.pins.includes(newSensor.options.pin)) {
    throw new Error('Pin ' + newSensor.options.pin +
      ' referenced for more than one component');
  }
  if (block.ids.includes(newSensor.options.id)) {
    throw new Error('Component id "' + newSensor.options.id + '" is not unique');
  }
  block.ids.push(newSensor.options.id);
  block.pins.push(newSensor.options.pin);

  if (block.pins.includes(newSensor.children.valve.options.pin)) {
    throw new Error('Pin ' + newSensor.children.valve.options.pin +
      ' referenced for more than one component');
  }
  if (block.ids.includes(newSensor.children.valve.options.id)) {
    throw new Error('Component id "' + newSensor.children.valve.options.id +
      '" is not unique');
  }
  block.ids.push(newSensor.children.valve.options.id);
  block.pins.push(newSensor.children.valve.options.pin);


  this['sensor' + sensorNum] = newSensor;
}

/**
 * Invert sensor boolean property, to add cleaner semantics to value tests
 *
 * 'this' is a sensor class instance object
 *
 * @return {boolean}
 */
block.getTooDry = function () {
  return !this.boolean;// Too dry when boolean is false
};

function controlCommandNow(ctl, command) {
  /* jshint validthis:true */
  var startState;
  if (ctl.id === undefined) {
    command = ctl.command;
    ctl = ctl.component;
  }

  startState = ctl.isOn;
  ctl[command]();
  ctl.metadata.lastActionTime = Date.now();

  // Trigger event for any data logging listener
  this.emit('stateChange', ctl, ctl.isOn, startState);
  // Source component, new state, previous state
}

five.Board.prototype.wait2 = function (time, callback, options) {
  setTimeout(callback.bind(this, options), time);
  return this;
};
/**
 * Executed a specifed command (method) on a control at a future time
 *
 * Use the supplied reference time, instead of new Date() for a bit of efficiency
 *
 * Every command will be further into the future: No insertions into the middle
 * of a queued series.
 *
 * @module {Integer} block.lastCmdTime Last executed/scheduled command time
 * @external {Integer} config.staggerTime Minimum time between hardware
 *                                  settings change commands commands
 *
 * @param {obmect} component        johnny-load extended johnny-five Relay
 * @param {Integer} minWait         Minimum wait time (milliseconds)
 * @param {string} command          name of method to execute
 * @return {undefined}
 */
function controlCommandAfter(component, minWait, command) {
  var nowTime;
  // console.log(nowString(), 'start controlCommandAfter for',
  //   component.id, minWait, command);//trace
  nowTime = Date.now();
  block.lastCmdTime = Math.max(block.lastCmdTime + config.hardwareCycleTime,
    minWait + nowTime);

  component.board.wait2(block.lastCmdTime - nowTime,
    controlCommandNow, { component: component, command: command });
}

/**
 * configure the model for the control system hardware
 *
 * This is a 'callback' function that will be run by johnny-five after it has
 * finished all the behind the scenes board setup.
 *
 * 'this' is the (just) setup board.
 *
 * @return {undefined}
 */
function boardIsReady() {
  /* jshint validthis:true */
  var properties;
  correctionInProgress = false;

  // Fill in details for the presure pump from the configuration file
  properties = Object.keys(config.pump);
  modelDescription.pump.options.pin = properties[0];
  modelDescription.pump.options.id = config.pump[properties[0]];
  block.pins = [];// If multiple boards, this needs to be unique for each board
  block.pins.push(modelDescription.pump.options.pin);
  block.ids = [];// This needs to be unique across all boards
  block.ids.push(modelDescription.pump.options.id);

  // Populate the model with sensor sets based on the user supplied information
  config.sensorPinSet.forEach(cloneSensor, modelDescription);

  this.children = jLoad(modelDescription, this);

  // Initialize the datalogging module, and give it a callback to use when done
  datalog.init(block.addComponentHandlers.bind(this), block.ids);
  datalog.addBoard(this);
}

/**
 * Add event handlers to the sensor components, to support both data logging
 * and out of range correction processing
 *
 * 'this' is the board instance the components are (physically) connected to
 *
 * @return {undefined}
 */
block.addComponentHandlers = function () {
  // console.log(nowString(), 'addComponentHandlers', this.id);//trace

  block.addLoggingHandlers.call(this);// For configured data logging
  block.addProcessHandlers.call(this);// For process monitoring and control

  // Initialize the hardware, and the initial logging data points
  controlCommandNow.call(this, this.children.pump, 'off');
  controlCommandNow.call(this, this.children.sensor0.children.valve, 'close');
  controlCommandNow.call(this, this.children.sensor1.children.valve, 'close');
  controlCommandNow.call(this, this.children.sensor2.children.valve, 'close');
  controlCommandNow.call(this, this.children.sensor3.children.valve, 'close');
  block.lastCmdTime = Date.now();
  block.lastCmdTime += 5000;//DEBUG 5 seconds so see visual states

  // The events and handlers are all setup now.  All further processing is
  // triggered by the ongoing sensor data events.
  console.log('monitoring and correction processing started');
  // console.log(nowString(), 'monitoring and correction processing started');
};

/**
 * Pass each component instance to the data logging module, to let it (choose
 * to) add logging event handlers
 *
 * 'this' is the board instance the components are (physically) connected to
 *
 * @return {undefined}
 */
block.addLoggingHandlers = function () {
  var p;
  this.children.pump.metadata.beenThere = true;// Simple skip of pump component
  for (p in this.children) {
    if (this.children.hasOwnProperty(p)) {
      if (!this.children[p].metadata) {
        throw new Error('no metadata for component', p);
      }
      if (!this.children[p].metadata.beenThere) {
        this.children[p].metadata.beenThere = true;
        datalog.addSensor(this.children[p]);
      }
    }
  }
  datalog.finalize();// Tell the data logging system there is nothing else to log
};

/**
 * Attach monitoring and correction events to each of the sensor 'blocks'
 *
 * 'this' is the board instance the components are (physically) connected to
 *
 * @return {undefined}
 */
block.addProcessHandlers = function () {
  var p;
  for (p in this.children) {
    if (this.children.hasOwnProperty(p)) {
      switch (this.children[p].metadata.usage) {
      case 'pressurize':
        break;// No explicit handling needed for the pump
      case 'measurement':
        // Add semantic inversion for sensor .boolean property
        Object.defineProperties(this.children[p], {
          tooDry: {
            get: block.getTooDry.bind(this.children[p])
          }
        });

        // With the current limitation of preventing multiple concurrent
        // corrections, need to continually watch the reported values for each
        // sensor, not just the changes.  Changes that occur while a correction
        // is in progress could get dropped, unless extra queueing logic was
        // added.  This seems simpler.  If desired, duplicates could be filtered
        // by the logging process.
        this.children[p].addListener('data', block.processSensorData);

        break;
      default:
        console.log('ERROR: invalid usage is ', this.children[p].metadata.usage);
      }
    }
  }
  // Can not add event handlers to non-emitter (relay) objects.  Use the
  // (always available) parent board as the source instead.
  // Add a single listner to handle out of range correction processing.  The
  // event will included information about which sensor / controller block is to
  // be processed.
  this.addListener('doCorrection', block.performCorrection);
};

/**
 * Trigger correction events as needed, and when valid to do so
 *
 * 'this' is the sensor instance
 *
 * sensor 'data' event handler
 *
 * @return {undefined}
 */
block.processSensorData = function () {
  var nowTick, v;
  // console.log(nowString(), 'processSensorData', this.id, this.value,
  //   this.boolean, this.tooDry);//trace
  nowTick = Date.now();// Sensor reading time stamp
  v = this.children.valve;// Valve used for correction processing
  // console.log('remaining wait time:',//DEBUG
  //   v.metadata.lastProcessed + v.metadata.adjustDelay - nowTick);//DEBUG
  if (this.tooDry && !correctionInProgress &&
      v.metadata.lastProcessed + v.metadata.adjustDelay - nowTick <= 0) {
    // Sensor value shows out of range (too dry) condition AND
    // No correction processing is currently in progress AND
    // Enough time has passed since the last correction process for the valve
    correctionInProgress = true;// Mark correction in progress, to block others
    v.metadata.lastProcessed = nowTick;// ?move to END of correction processing?
    // console.log('emit doCorrection');//trace
    this.board.emit('doCorrection', v);
  }
};

/**
 * Execute the out of range correction process for a sensor value
 *
 * 'this' is the board
 *
 * 'doCorrection' event handler
 *
 * @param {object} component  johnny-load extended johny-five (relay) component
 * @return {undefined}
 */
block.performCorrection = function (component) {
  var operationWait;
  // console.log(nowString(), 'performCorrection using', component.id);//trace
  // Queue up the timed sequence of actions to correct the out of range condition
  operationWait = 0;
  operationWait += 100;//DEBUG get past sensor logging for this pass
  controlCommandAfter(component.children.pump, operationWait, 'on');
  operationWait += component.children.pump.metadata.warmup;
  controlCommandAfter(component, operationWait, 'open');
  operationWait += component.metadata.adjustTime;
  controlCommandAfter(component, operationWait, 'close');
  operationWait += component.children.pump.metadata.cooldown;
  controlCommandAfter(component.children.pump, operationWait, 'off');

  // Clear the semaphore flag after the sequence has completed
  block.lastCmdTime += config.hardwareCycleTime;
  component.board.wait(block.lastCmdTime - Date.now(), block.endCorrecton);//DEBUG
};

block.endCorrecton = function () {
  // console.log(nowString(), 'endCorrecton');//trace
  correctionInProgress = false;
};

// This is where the program actully starts running.  It is kept at the end,
// after the callback function boardIsReady has been created, so that the
// jslint program does not complain about using something before it was defined.
// The way javascript works, it is not a technical requirement.  Just good
// practice.

new five.Board({ id: 'water controller'}).on('ready', boardIsReady);
