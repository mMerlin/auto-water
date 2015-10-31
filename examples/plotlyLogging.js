/*
This is an example userinfo.js file that configures 4 sensors, 4 solenoids
(Johnny-five relay components), plus a pump to water plants when the sensors
show that the soil is too dry.  It then logs the sensor readings and the
digital state change events to multiple plotly files, using multiple accounts.

This is not the simplest case to setup.  It is intended to show some of the
provided capabilities.

To run this as a demostration, as configured, requires 2 plotly account user
names with their api keys, plus 6 streaming tokens for the first account, and
4 for the second.  To use a single account, make all the user name references
the same, and 10 tokens are needed to create the 3 plot files.

This should work with any johnny-five compatible board that has 4 analog inputs
and 4 digital outputs.

To be able to do more than show that the plots are being created, sources for
the analog inputs are needed to simulate the values from  sensor readings.
Potentiometers configured as voltage dividers would work fine.  Adding LEDs to
the pump and solenoid pins would provide local feedback of the processing, and
show the time delay between actual events, and when they show up on the
streaming plots.
 */
var pointsPerControlTrace, pointsPerSensorTrace;

// Configuration information for the hardware setup, and process control
// parameters.
// For this example file, the time periods are considerably shorter than would
// be appropriate for an actual watering system.  People usually do not want to
// wait an hour for the next change.
module.exports.process = {
  sensorPeriod: 1000,// 1 second
  blockTime: 120000,// 2 minutes
  dryLimit: 700,// Less than this is 'too dry'
  pump: {
    5: "Water Pump"
  },
  pumpWarmup: 1000,// milliseconds to bring pressure to nominal before watering
  pumpCooldown: 500,// milliseconds to hold presure (to seat solenoid) after
  flowTime: 4000,// milliseconds for single corrective action (4 seconds)
  sensorPinSet: [
    [{ "A0": "Moisture Sensor 1" }, { 8: "Solenoid 1"}],
    [{ "A1": "Moisture Sensor 2" }, { 4: "Solenoid 2"}],
    [{ "A2": "Moisture Sensor 3" }, { 3: "Solenoid 3"}],
    [{ "A3": "Moisture Sensor 4" }, { 7: "Solenoid 4"}]
  ],
  hardwareCycleTime: 1000// minumum ms between hardware 'power' operations
};

// Configuration information for the (any) data logging configuration.  Which
// events to log, and which trace (key) to associate with logged events.
pointsPerControlTrace = 80;// Default number of points to keep on screen for
pointsPerSensorTrace = 800;// control event and sensor data traces
module.exports.logging = {
  activeModule: "./lib/plotlyLogging",
  plotlyLogging: {
    authentication: [
      {
        userName: "firstPlotlyUserName",
        apiKey: "apikey0001",
        tokens: [
          "strm0token",
          "strm1token",
          "strm2token",
          "strm3token",
          "strm4token",
          "strm5token"
        ]
      },
      {
        userName: "secondPlotlyUserName",
        apiKey: "apikey0002",
        tokens: [
          "strm6token",
          "strm7token",
          "strm8token",
          "strm9token"
        ]
      }
    ],
    target: {
      userName: "firstPlotlyUserName",
      graphOptions: {
        fileopt: "overwrite"
      }
    },
    plots: [
      {
        target: {
          graphOptions: {
            filename: "water/Sensors"
          }
        },
        trace: {
          mode: "lines",
          type: "scatter",
          line: {
            shape: "linear"
          },
          stream: {
            maxPoints: pointsPerSensorTrace
          }
        },
        plotData: [
          {
            component: "Water Pump",
            mode: "lines",
            type: "scatter",
            line: {
              shape: "hv"
            },
            stream: {
              maxPoints: pointsPerControlTrace * 4
            },
            transform: {
              true: 0,
              false: 99
            }
          },
          { component: "Moisture Sensor 1" },
          { component: "Moisture Sensor 2" },
          { component: "Moisture Sensor 3" },
          { component: "Moisture Sensor 4" }
        ]
      },
      {
        target: {
          graphOptions: {
            filename: "water/Solenoid"
          }
        },
        plotData: [
          {
            mode: "lines",
            type: "scatter",
            line: {
              shape: "hv"
            },
            stream: {
              maxPoints: pointsPerControlTrace
            },
            component: "Solenoid 1",
            transform: {
              false: 10,
              true: 19
            }
          }
        ]
      },
      {
        trace: {
          mode: "lines",
          type: "scatter",
          line: {
            shape: "hv"
          },
          stream: {
            maxPoints: pointsPerControlTrace
          }
        },
        target: {
          userName: "secondPlotlyUserName",
          graphOptions: {
            filename: "Tomatoes/Valves",
            fileopt: "overwrite"
          }
        },
        plotData: [
          {
            component: "Solenoid 1",
            transform: {
              false: 0,
              true: 0.9
            }
          },
          {
            component: "Solenoid 2",
            transform: {
              false: 1,
              true: 1.9
            }
          },
          {
            component: "Solenoid 3",
            transform: {
              false: 2,
              true: 2.9
            }
          },
          {
            component: "Solenoid 4",
            transform: {
              false: 3,
              true: 3.9
            }
          }
        ]
      }
    ]
  }
};
