var heatmiser = require("../lib/heatmiser");

var neo = new heatmiser.Neo("192.168.1.112");

neo.on('success', function(data) {
  console.log(data);
});
neo.on('error', function(data) {
  console.log(data);
});

neo.info();
neo.statistics();

var devices = ['bathroom', 'livingroom'];

neo.setAway(false, devices);
neo.setStandby(false, devices);

var comfortLevels = {
    "bathroom": {
        "monday": {
            "wake": ["07:00", 20],
            "leave": ["09:00", 16],
            "return": ["24:00", 21],
            "sleep": ["24:00", 16]
        },
        "sunday": {
            "wake": ["09:00", 20],
            "leave": ["11:00", 16],
            "return": ["24:00", 21],
            "sleep": ["24:00", 16]
        }
    },
    "livingroom": {
        "monday": {
            "wake": ["07:00", 19],
            "leave": ["08:30", 16],
            "return": ["16:30", 19],
            "sleep": ["23:00", 16]
        },
        "sunday": {
            "wake": ["09:00", 19],
            "leave": ["10:00", 16],
            "return": ["20:00", 19],
            "sleep": ["23:00", 16]
        }
    }
}

var keys = Object.keys(comfortLevels);
for (var i=0; i<keys.length; i++) {
  var name = keys[i];
  neo.setComfortLevels(comfortLevels[name], [name]);
}


var wait = function() {
  console.log("waiting");
}
setTimeout(wait, 1000);
