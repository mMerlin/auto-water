description: [
  "The consoleLogging module sends configured events to the console.  It",
  "only needs a traceLookup object with propery names matching the",
  "Ids of the components that are to have events logged.  The property",
  "values are used to prefix the associated event data points."
],

Configure which devices to report information about, and the label to report
with the values.  Any device id configured above in the .process object can
be used as a data logging source.  For sensors, the data is the actual senors
reading.  For the pump and solenoids, the data is the on/off, open/close
state changes.  States are simple true/false values.
"The plotlyLogging modules sends configure events to plot.ly plots using",
"specified, options.  Plotly username and api key need to be filled in,",
"as well as associated plotly tokens to the the trace for each event.",
"This module supports multiple simultaneous plots.  All events can be",
"displayed as traces on a single plot; each event can be shown on a",
"separate trace; or any combination of events and traces, including",
"displaying traces on multiple plots.  Common / repeated plot and trace",
"information can be provided in template objects, either / both for the",
"whole plotlyLogging configuration, or for individual plots.  Templates",
"values 'cascade'.  Any actual value will be used.  If that does not",
"exist, the value will be taken from current plot template.  If that does",
"not exist either, The value will be taken from the top level",
"plotlyLogging template.  Every required property, for every plot, must",
"exist in one of those three locations.  Values that must be unique for",
"every plot are not allowed in the templates."
