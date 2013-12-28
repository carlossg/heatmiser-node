heatmiser-node
==============

A nodejs module to talk to heatmiser thermostats

Credits

* Ben Pirt for the reading functions in Node https://github.com/bjpirt/heatmiser-js
* heatmiser-wifi Perl project for the overall ideas and algorithms https://code.google.com/p/heatmiser-wifi/

# Reading the thermostat status

    var hm = new Heatmiser('localhost', 1234);

    hm.on('success', function(data) {
      console.log(data);
    });
    hm.on('error', function(data) {
      console.log(data);
    });

    hm.read_device();

# Writing to the thermostat

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
