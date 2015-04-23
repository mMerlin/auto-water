Control and log sensor based watering events

Use sensors to control the activation of a pump and (one at a time) solenoids to
maintain the desired moisture levels.  Record each watering event to an online
charting application.  Only one valve is every opened at once.  That is a
deliberate design choice.  The water source is not pressurized, and the pump
being used is not strong enough to handle more than one at a time.

Technologies used:
RaspberryPi

Arduino
- StandardFirmata
node.js
- johnny-five
- plotly


Reference Information
Johnny-five
- repository https://github.com/rwaldron/johnny-five
- documentation https://github.com/rwaldron/johnny-five/wiki

plotly
- https://github.com/plotly-nodejs (README)

#Install
```bash
git clone https://github.com/mMerlin/auto-water.git
cd auto-water
npm install
mkdir .private
cp userinfo.js .private/
```
This project needs private information from an https:plot.ly account.  To finish
the configuration, manually edit **only** the .private/userinfo.js file to fill
in your personal information.  That could be (mostly) automated, but I do not
want to play with that yet.  Same thing for setting up the plot.ly account, and
getting the apikey and tokens.  Use the plot.ly information to figure out how.
No tutorial is being provided here.

TODO:
This should have a github-pages branch, with more project information, and
pictures.  It is not **ALL** software!
