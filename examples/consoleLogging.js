// This is an example userinfo.js configuration to log some, but not all, of the
// available application information to the console (terminal window) the
// application is run from.
//
// Check each configured sensor every minute
// Prevent corrections (watering) more than once each hour
// Do a correction when a sensor reading drops below 700
// The control for the water pump is connected to pin 5 of the microcontroller
// Run the pump for 1 second before turning on a valve
// Keep the pump running for half a second after closing the valve
// Water for 8 seconds when the sensor shows too dry
// Configure 4 sensors with associated valve controlling solenoids, providing
// names that help identify them for the physical setup
// Prevent hardware power actions (pump on/off; solenoid open/close) closer
// together than 250ms (help power stability)
module.exports.process = {
  sensorPeriod: 60000,// 60000 millisecond = 1 minute: time between data reads
  blockTime: 360000,// 3600000 millisecond = 1 hour: min time between corrections
  dryLimit: 700,// Less than this is 'too dry'
  pump: {
    5: "Water Pump"
  },
  pumpWarmup: 1000,// milliseconds to bring pressure to nominal
  pumpCooldown: 500,// milliseconds to hold presure (to seat solenoid)
  flowTime: 8000,// milliseconds for single corrective action (8 seconds)
  sensorPinSet: [
    [{ "A0": "Top Level" }, { 8: "Red Solenoid"}],
    [{ "A1": "Bottom Level" }, { 4: "Orange Solenoid"}],
    [{ "A2": "Right Side" }, { 3: "Green Solenoid"}],
    [{ "A3": "Left" }, { 7: "North Solenoid"}]
  ],
  hardwareCycleTime: 250// minumum ms between hardware 'power' operations
};

// Setup logging to (only) the console windows, and specify which events to
// to report.
//
// Make the consoleLogging package the active data logging module.
// Report when the water pump turn on and off, prefixing the line with 'pump'
// Report the left (A3) sensor readings, prefixing the lines with 'level'
// Report opening and closing of the Orange Solenoid with a line label of ''
module.exports.logging = {
  activeModule: "./lib/consoleLogging",
  consoleLogging: {
    traceLookup: {
      "Water Pump": "pump",
      "Left": "level",
      "Orange Solenoid": "valve2"
    }
  }
};
