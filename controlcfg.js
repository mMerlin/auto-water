'use strict';

function nowString() { return new Date().toISOString(); }
var maxData = 200;      // number of data points displayed on a streaming graph
var pumpPin = 8;        // single pin number to turn pump motor on and off
// var heartbeatPin = 12;  // any available (otherwise unused) pin
// var heartbeatPin = 'A5';  // digital pin number failed in new Sensor()
// var heartRate = 30000;  // once every 30 seconds
var sensorReadRate = 120000;//milliseconds -- 2 minutes
var sensorPins = ['A0', 'A1'];
var valvePins = [1, 3];

// Template for a trace to associate with a (Plotly) plot
var dataTemplate = {
  x: [],
  y: [],
  stream: {
    maxpoints: maxData
  }
};

/***
 * Make sure there are enough configured sensors and valves to support the
 * number of log traces being configured
 *
 * @param {integer} traceCount The number of configured trace logs
 * @return {undefined}
 */
function checkConfiguredHardware(traceCount) {
  module.exports.controller.nTraces = Math.min(
    traceCount,
    sensorPins.length,
    valvePins.length,
    module.exports.controller.off.length,
    module.exports.controller.on.length
  );
}// ./function checkConfiguredHardware(traceCount)

/***
 * Create an array of (trace) entries for a plot
 *
 * @param {array of string} tokens    The tokens to associate with the traces
 * @return {array of Object}
 */
function buildPlotData(tokens) {
  var i, trace, plot;
  // console.log(nowString(), 'start buildPlotData');//trace
  // console.log(nowString(), 'template:', dataTemplate);//DEBUG
  // console.log(nowString(), 'tokens:', tokens);//DEBUG
  // Limit the number of configured traces to the number of available sensors
  // and valves
  checkConfiguredHardware(tokens.length);
  console.log(nowString(), 'number of traces to configure:',
    module.exports.controller.nTraces
    );//DEBUG
  plot = [];
  for (i = 0; i < module.exports.controller.nTraces; i += 1) {
    trace = JSON.parse(JSON.stringify(dataTemplate));
    trace.stream.token = tokens[i];
    plot.push(trace);
  }
  return plot;
}

/***
 * Create a moisture sensor configuration object
 *
 * @param {integer} index     The index for pin to use for the sensor
 * @return {Object}
 */
function sensorConfig(index) {
  return {
    pin: sensorPins[index],
    freq: sensorReadRate,
    id: 'Moisture Sensor ' + index
  };
}// ./function buildSensorConfig(index)

/***
 * Create valve (solenoid) control
 *
 * @param {integer} index     The index for the pin to use to control the valve
 * @return {Object}
 */
function valveConfig(index) {
  return {
    pin: valvePins[index],
    id: "Solenoid " + index,
    type: "NC"
  };
}// ./function valveConfig(index)

module.exports = {
  controller: {
    tooDryValue: 700, // Greater than this is OK
    flowtime: 10000,  // time for out of range correction event (ms) - 10 seconds
    hardwareDelay: 1000, // minimum delay (ms) between slave hardware setting
                      // operations (that change power usage)
    off: [0, 2],      // graph values per trace and state
    on: [1, 3],
    // Should have a 'momentum' factor somewhere: delay a second watering long
    // enough that the results of the first have reached the sensors
    pumpConfig: {
      pin: pumpPin,
      type: "NO",     //Normally Open contacts: engerize to turn on
      id: "Water Pump"
    },
    heartRate: 30000  // once every 30 seconds
    // heartbeatConfig: {
    //   pin: heartbeatPin,
    //   freq: heartRate,
    //   id: "Heart Beat"
    // }
  },
  plotly: {
    graphOptions: {
      fileopt: 'extend',
      filename: 'Tomatoes',
      title: 'Tomato Watering Schedule',
      xaxis: {
        title: 'Date/Time'
      },
      yaxis: {
        title: 'On/Off'
      }
    },
    messages: {
      multipleStreams: 'All Streams Go!'
    },
    throttleTime: 100 //milliseconds
  },
  buildPlotData: buildPlotData,
  sensorConfig: sensorConfig,
  valveConfig: valveConfig
};

/*
  sensorReadRate      The time (milliseconds) between reads of the controlling
      sensor value.  This should be the longest time that the measured value
      could be 'out of band' before being noticed.  Only 'should', because
      processing being done for other sensors could increase this time.  The
      event can not trigger until all current processing as finished.
  graphOptions        an Object containing styling options like axis information
      and titles for the graph.
  multipleStreams     Expected success streamstatus value on successfull plot
      initialization with multiple traces.
*/
