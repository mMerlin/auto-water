**Datalogging API**

The datalogging api used for the auto-water application is 4 methods exposed (exported) by the datalogging module.

* init(callback, components)</br>
The init method must be called once, before any of the other api methods are called.  Parameters are:
  * callback</br>
The method to call when the datalogging module is finished any needed initialization.
  * components</br>
Array of (strings) of component ids that the main application is making available for data logging.
* addSensor(component)</br>
The addSensor method must be called once for each sensor component that can have readings logged.
  * If there are no sensor components, this method does not need to be called.
  * All calls to this method must be after the call to init, and before the call to finalize.
  * component</br>
A component that emits data events.
* addBoard(component)</br>
This method must be called once for each board that emit any events associated with non-sensor components, that could be logged.  Boards that only have sensor components attached do not needed to be added.  Sensor events will be found when the sensor components are added.
  * This method needs to be called at least once, even if there are no non-sensor components.
  * All calls to this method must be after the call to init, and before the call to finalize.
  * component</br>
Any component attached to the board, or the board element itself.
* finalize()</br>
The finalize method must be called once after all calls to addSensor and addBoard have completed.

After setup with the api methods, the application emits 'stateChange' events from the parent board when sending on and off (or aliased) commands to the non-sensor components.  Sensor components already send various data related events that the datalogging module can listen for.
