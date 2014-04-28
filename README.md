heatmiser-node
==============

A nodejs module to talk to Heatmiser WiFi and Neo thermostats

See more examples in the `examples` dir

# Heatmiser Neo

    var heatmiser = require('heatmiser');
    var neo = new heatmiser.Neo("192.168.1.100");

    neo.on('success', function(data) {
      console.log(data);
    });
    neo.on('error', function(data) {
      console.log(data);
    });

    neo.info();
    neo.statistics();
    neo.setAway(true, ["living","kitchen"]);


# Heatmiser WiFi

## Reading the thermostat status

    var heatmiser = require('heatmiser');
    var hm = new heatmiser.Wifi('localhost', 1234);

    hm.on('success', function(data) {
      console.log(data);
    });
    hm.on('error', function(data) {
      console.log(data);
    });

    hm.read_device();

## Writing to the thermostat

    var dcb;

    // set frost mode
    dcb = {
      runmode: 'frost'
    }
    hm.write_device(dcb);

    // set current date and time
    dcb = {
      time: new Date()
    }
    hm.write_device(dcb);

    // set the thermostat hold
    dcb = {
      heating: {
        target: 20, // C
        hold: 30 // minutes
      }
    }
    hm.write_device(dcb);

# Credits

* Ben Pirt for the Heatmiser WiFi reading functions in Node https://github.com/bjpirt/heatmiser-js
* heatmiser-wifi Perl project for the overall ideas and algorithms https://code.google.com/p/heatmiser-wifi/
