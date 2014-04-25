var heatmiser = require("../lib/heatmiser");

var hm = new heatmiser.Wifi("192.168.1.100", 1234);

hm.on('success', function(data) {
  console.log(data);
});
hm.on('error', function(data) {
  console.log(data);
});

hm.read_device();

var dcb;

// set temperature

// target before hold!
var dcb1 = {
  heating: {
    target: 20
  }
}
var dcb2 = {
  heating: {
    hold: 5
  }
}

hm.write_device(dcb1);
hm.write_device(dcb2);

// // set frost mode
dcb = {
  runmode: 'frost'
}
hm.write_device(dcb);

// // set current date and time
dcb = {
  time: new Date()
}
hm.write_device(dcb);
