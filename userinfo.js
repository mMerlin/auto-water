// This is a template for the configuration file to use to setup the auto-water
// package.  See the .docs and .examples directories for more information
//
// Configuration information for the hardware setup, and process control
// parameters.  This provides all of the details the applications needs to do
// the actually monitoring and control.
module.exports.process = {
  sensorPeriod: 10000,// 60000 millisecond = 1 minute: time between data reads
  blockTime: 110000,// 3600000 millisecond = 1 hour: min time between corrections
  dryLimit: 700,// Less than this is 'too dry'
  pump: {
    5: "Water Pump"
  },
  pumpWarmup: 1000,// milliseconds to bring pressure to nominal
  pumpCooldown: 500,// milliseconds to hold presure (to seat solenoid)
  flowTime: 8000,// milliseconds for single corrective action (8 seconds)
  sensorPinSet: [
    [{ "A0": "Moisture Sensor 1" }, { 8: "Solenoid 1"}],
    [{ "A1": "Moisture Sensor 2" }, { 4: "Solenoid 2"}],
    [{ "A2": "Moisture Sensor 3" }, { 3: "Solenoid 3"}],
    [{ "A3": "Moisture Sensor 4" }, { 7: "Solenoid 4"}],
    [{ "A4": "Moisture Sensor 5" }, { 9: "Solenoid 5"}],
    [{ "A5": "Moisture Sensor 6" }, { 12: "Solenoid 6"}]
  ],
  hardwareCycleTime: 1000// minumum ms between hardware 'power' operations
};

// Configuration information for logging the status of auto-water appliction.
// A 'full' configuration specifies that package to use to do the logging, and
// any configuration that package will need.  On startup, the application will
// call specific methods exported by the specified datalogging package (the api),
// then emit events that the logging package can use to track changes.  See the
// .docs and .examples folders for more details and samples.  This template does
// not configure any logging.  More accurately, it configures a logging package
// that does not actually do any logging.
module.exports.logging = {
  activeModule: "./lib/noLogging"
};
