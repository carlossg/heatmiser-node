heatmiser-node
==============

A nodejs module to talk to heatmiser thermostats

Taken from Ben Pirt heatmiser-js and stripped to leave only the bits to interact with the thermostat
https://github.com/bjpirt/heatmiser-js

# Reading the thermostat status

    var hm = new Heatmiser('localhost', 1234);
    hm.read_device(function(success) {
      console.log(success);
    }, function(error) {
      console.log(error);
    });

# Writing to the thermostat

    var log = function(msg) {
      console.log(msg);
    }

    // set the time
    hm.write_device({
      time: new Date()
    }, log, log);

    // set the thermostat to frost mode
    hm.write_device({
      runmode: 'frost'
    }, log, log);

    // set the thermostat hold
    hm.write_device({
      heating: {
        target: 20, // C
        hold: 30 // minutes
      }
    }, log, log);
