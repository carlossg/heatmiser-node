#!/usr/bin/env node

var hm = require('../lib/heatmiser');
var argv = require('optimist').argv;

if(argv['h'] === undefined || argv['p'] === undefined){
  console.log ("Usage: " + argv["$0"] + " -h <host> -p <pin>");
  process.exit();
}

hm.read_device(argv.h, 8068, argv.p, function(result){
  console.log(result);
});
