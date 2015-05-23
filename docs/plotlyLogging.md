#PlotlyLogging configuration#
The plotlyLogging package logs data to one or more plot.ly plots (filenames), with one or more traces for each plot.&nbsp; When multple plots are configured, each plot can be on the same or different
plot.ly account (userName + apiKey)

##userinfo.js, module.exports.{property}##

The process property is an object (structure) that contains information about the hardware setup, and processing.

The logging property is an object that contains the settings for the datalogging package(s) that will be used to record information about the processing.

The logging.plotlyLogging property is an object that contains information about the plot.ly plot(s) (filenames) that will be used, and the processing events that are to be recorded to those plot(s) and trace(s).

###Structure overview###
* module.exports.logging.plotlyLogging {}
  * authentication []
    * accountInformationElement {}
      * userName
      * apiKey
      * tokens []
  * target {}
  * trace {}
  * plots []
    * plotArrayElement {}
      * target {}
        * userName
        * graphOptions
          * filename
          * fileopt
      * trace {}
      * plotData []
        * plotDataArrayElement {} (trace)
          * mode
          * type
          * line
            * shape
          * stream
            * maxpoints
          * component
          * transform

###Descriptions and Expansions###
* authentication</br>
This required object property contains the plot.ly account specific information needed to create and stream data to files on the plot.ly system.&nbsp; The details are gathered together in a single object to make cut and paste copying from the plot.ly user page easier.&nbsp; The rest of the configuration structure needs only the userName property, automatically collecting the related information from the authentication object properties.
* target</br>
plotlyLogging.target is an optional template object.&nbsp; It is really only useful when multiple plots are being configured with common information.&nbsp; It holds default target property values for all configured plots.&nbsp; When a single plot is being configured, plotArrayElement.target is a better choice.&nbsp; plotArrayElement.target is a required object, unless all required properties are provided by plotlyLogging.target properties.
* trace</br>
This is an optional template object.&nbsp; The plotlyLogging.trace template is really only useful when multiple plots are being configured.&nbsp; It holds default trace property values for all configured plosts.&nbsp; For a single plot, plotArrayElement.trace is a better choice.&nbsp; The plot specific template is useful any time more than one trace is used for a single plot.&nbsp; Either/both of the trace templates can have most of the same properties as the plotDataArrayElement object.&nbsp; The exception is the component property, which must be  unique to an individual trace, and is not allowed in the templates.
* plots</br>
This is a required array property.&nbsp; Each element of the array is an object structure with configuration information for a single plot.ly plot file.
* plotArrayElement</br>
This is not an actual property name.&nbsp; It is a placeholder for an anonymous (unnamed) object that is an element of the plots array.
* plotData</br>
This is a required object property.&nbsp;  Each element of the array is an object structure with configuration information for a single trace (stream) within the plot.&nbsp; The array contents, except for the component and transform element properties are passed directly to plotly.plot during plot initialization.&nbsp; See https://github.com/plotly/plotly-nodejs (search for plotly.plot) for example usage.
* plotDataArrayElement</br>
This is not an actual property name.&nbsp; It is a placeholder for an anonymous (unnamed) object that is an element of the plotData array.&nbps; Some common properties are checked for and validated.&nbsp; Others are passed through unchecked.&nbsp; The x and y empty array properties do not need to be included.&nbsp; They are always needed for streaming plots, and are are provided automatically by the datalogging code.&nbsp; Properties that require values can be provided here, or in one of the trace template objects.&nbps;  Properties that are provided here override the template properties.&nbsp; Any property (including optional, unchecked properties) that is not provided here, will be filled in (first) from the plotArrayElement.trace object, then from plotlyLogging.trace, if that contains additional properties.&nbps; All properties, except for transform, are currently required.
  * NOTE: the line object should only be needed if mode includes 'lines'
* userName</br>
A required string property containing a plot.ly account user name.
* apiKey</br>
A required string property containing the api key for the plot.ly account.
* graphOptions</br>
A required object property containing high level information about the plot being created.&nbsp; This object (after merging with target template properties) is passed directly to plot.ly during plot creation using plotly.plot.&nbsp; For some information about the posible properties and values, see https://plot.ly/rest/, click "POST /clientresp" to expand that section, then scroll down to the block at "kwargs".&nbsp; Not all valid (for plotly) property values and combinations may work (as expected) with plotlyLogging.&nbps; The module does not parse the (other) provided properties, or know how to figure out how they might affect the streamed data logging.
* tokens</br>
This is a required array of plot.ly data streaming tokens for the plot.ly account.&nbsp; At least enough tokens must be supplied to provide one for each trace of each plot used for the account.&nbsp; Tokens can not be used on more than one plot at a time, so they need to stay unique across the whole applications.&nbsp; If multiple applications are simultaneously streaming data to plot files for a single plot.ly accounts, the tokens need to be keep unique across all of the applications.
