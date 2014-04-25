"use strict";

var net = require('net');
var util = require("util");
var events = require('events');

function Wifi(host, pin, port, model) {
  this.host = host;
  this.pin = pin;
  this.port = (typeof port === "undefined") ? 8068 : port;
  this.model = (typeof model === "undefined") ? null : model;
  events.EventEmitter.call(this);
}

util.inherits(Wifi, events.EventEmitter);

var crc16 = function(buf){
  // Thanks to http://code.google.com/p/heatmiser-wifi/ for the algorithm
  // Process 4 bits of data
  var crc16_4bits = function(crc, nibble){
    var lookup = [0x0000, 0x1021, 0x2042, 0x3063,
                  0x4084, 0x50A5, 0x60C6, 0x70E7,
                  0x8108, 0x9129, 0xA14A, 0xB16B,
                  0xC18C, 0xD1AD, 0xE1CE, 0xF1EF];
    return ((crc << 4) & 0xffff) ^ lookup[(crc >> 12) ^ nibble];
  }

  // Process the whole message
  var crc = 0xffff;
  for(var i=0; i<buf.length; i++){
    crc = crc16_4bits(crc, buf[i] >> 4);
    crc = crc16_4bits(crc, buf[i] & 0x0f);
  }

  // Return the CRC
  return crc;
}



var parse_dcb = function(dcb_buf){
  var model = ['DT', 'DT-E', 'PRT', 'PRT-E', 'PRTHW'][dcb_buf.readUInt8(4)];
  var version = dcb_buf.readUInt8(3);
  var length = dcb_buf.readUInt16LE(0);
  if(length != dcb_buf.length) throw "Incorrect DCB length";
  if(model !== 'PRTHW') version &= 0x7F;
  var program_mode = ['5/2', '7'][dcb_buf.readUInt8(16)];

  return {
    length: length,
    vendor_id: ['HEATMISER', 'OEM'][dcb_buf.readUInt8(2)],
    model: model,
    version: version/10,
    temp_format: ['C', 'F'][dcb_buf.readUInt8(5)],
    switch_differential: dcb_buf.readUInt8(6)/2,
    frost_protection: !!dcb_buf.readUInt8(7),
    calibration_offset: dcb_buf.readUInt16LE(8),
    output_delay: dcb_buf.readUInt8(10),
    up_down_key_limit: dcb_buf.readUInt8(11),
    sensor_selection: ['built_in_only', 'remote_only', 'floor_only', 'built_in+floor', 'remote+floor'][dcb_buf.readUInt8(13)],
    optimum_start: dcb_buf.readUInt8(14),
    rate_of_change: dcb_buf.readUInt8(15),
    program_mode: program_mode,
    frost_protect_temp: dcb_buf.readUInt8(17),
    set_room_temp: dcb_buf.readUInt8(18),
    floor_max_limit: dcb_buf.readUInt8(19),
    floor_max_limit_enabled: !!dcb_buf.readUInt8(20),
    device_on: !!dcb_buf.readUInt8(21),
    key_lock: !!dcb_buf.readUInt8(22),
    run_mode: ['heating', 'frost_protection'][dcb_buf.readUInt8(23)],
    away_mode: !!dcb_buf.readUInt8(24),
    holiday_enabled: !!dcb_buf.readUInt8(30),
    holiday_return_date: {},
    temp_hold_minutes: dcb_buf.readUInt16LE(31),
    remote_air_temp: dcb_buf.readUInt16LE(33) === 0xFFFF ? null : dcb_buf.readUInt16LE(33)/10,
    floor_temp: dcb_buf.readUInt16LE(35) === 0xFFFF ? null : dcb_buf.readUInt16LE(35)/10,
    built_in_air_temp: dcb_buf.readUInt16LE(37) === 0xFFFF ? null : dcb_buf.readUInt16LE(37)/10,
    error_code: dcb_buf.readUInt8(39),
    heating_on: !!dcb_buf.readUInt8(40),
    boost_in_min: dcb_buf.readUInt16LE(41),
    hot_water_on: !!((model == 'PRTHW') ? dcb_buf.readUInt8(43) : false),
    current_time: extract_date(dcb_buf, model),
  }
}

var extract_date = function(dcb_buf, model){
  var offset = (model == 'PRTHW') ? 3 : 0
  return new Date(2000 + dcb_buf.readUInt8(41 + offset), dcb_buf.readUInt8(42 + offset) -1 , dcb_buf.readUInt8(43 + offset), dcb_buf.readUInt8(45 + offset), dcb_buf.readUInt8(46 + offset), dcb_buf.readUInt8(47 + offset))
}

var parse_response = function(response){
  var code = response.readUInt8(0);
  if(code != 0x94) throw "Invalid return code";
  var frame_len = response.readUInt16LE(1);
  if(frame_len != response.length) throw "Incorrect packet length";
  var crc = response.readUInt16LE(frame_len - 2);
  var calc_crc = crc16(response.slice(0, frame_len - 2));
  if(crc != calc_crc) throw "Incorrect CRC";

  return {
    code: code,
    frame_len: frame_len,
    crc: crc,
    start_addr: response.readUInt16LE(3),
    num_bytes: response.readUInt16LE(5),
    dcb: parse_dcb(response.slice(7, frame_len - 2))
  }
}

// Construct an arbitrary thermostat command
Wifi.prototype.command = function(operation, data, callback) {
  var len = 7 + data.length;
  var buf = new Buffer(5+data.length+2);
  buf.writeUInt8(operation, 0); // 0
  buf.writeUInt16LE(len, 1); // 1-2
  buf.writeUInt16LE(this.pin, 3); // 3-4
  data.copy(buf, 5);
  var crc = crc16(buf.slice(0,buf.length-2));
  buf.writeUInt16LE(crc, buf.length-2); // last 2 bytes

  var client = net.connect({host: this.host, port: this.port}, function() { //'connect' listener
    client.write(buf);
  });

  client.setTimeout(3000);
  client.on('data', function(data) {
    var obj = parse_response(data);
    this.model = obj.dcb.model;
    // if callback is set don't emit an event
    if (typeof callback === 'undefined') {
      this.emit('success', obj);
    } else {
      callback(obj);
    }
    client.end();
  }.bind(this));
  client.on('timeout', function(e){
    client.end();
    this.emit('error', (typeof e === 'undefined') ? new Error("Timed out") : e);
  }.bind(this));
  client.on('error', function(e){
    client.end();
    this.emit('error', e);
  }.bind(this));
}

Wifi.prototype.read_device = function(callback){
  this.info(callback);
}

Wifi.prototype.info = function(callback){
  this.command(0x93, new Buffer([0x00, 0x00, 0xFF, 0xFF]), callback);
}

Wifi.prototype.write_device = function(data) {
  var self = this;

  var do_write = function(items) {
    var buf = Buffer.concat(items);
    // First byte to send is the number of items
    var buffer = new Buffer(buf.length+1);
    buffer[0] = items.length;
    buf.copy(buffer, 1);

    self.command(0xa3, buffer);
  }

  if (this.model == null) {
    this.read_device(function(){
      try {
        status_to_dcb(this.model, data, do_write);
      } catch (e) {
        this.emit('error', e);
      }
    });
  } else {
    try {
      status_to_dcb(this.model, data, do_write);
    } catch (e) {
      this.emit('error', e);
    }
  }
}

var dcb_entry = function(position, data) {
  var l = (typeof data === 'number') ? 1 : data.length
  var buf = new Buffer(2+1+l); // position, length, data
  buf.writeUInt16LE(position, 0);
  buf.writeUInt8(l, 2);
  if(typeof data === 'number') {
    if (data % 1 == 0) {
      // integer
      buf.writeUInt8(data, 3);
    } else {
      // float, wrong type
      throw "Float value not valid, must be integer: " + data;
    }
  }
  else {
    data.copy(buf, 3);
  }
  return buf;
}

var timeToByteBuffer = function(hours, minutes) {
  var buf = new Buffer(2);
  buf[0] = hours;
  buf[1] = minutes;
  return buf;
}

var dateTimeToByteBuffer = function(datetime) {
  var buf = new Buffer(7);
  var i = 0;
  buf[i++] = datetime.getFullYear()-2000;
  buf[i++] = datetime.getMonth()+1;
  buf[i++] = datetime.getDate();
  var day = datetime.getDay();
  buf[i++] = day == 0 ? 7 : day; // 0 Sunday -> 7
  buf[i++] = datetime.getHours();
  buf[i++] = datetime.getMinutes();
  buf[i++] = datetime.getSeconds();
  return buf;
}

var status_to_dcb = function(model, data, callback) {
  var items = [];

  var keys = Object.keys(data);
  for (var i=0; i<keys.length; i++) {
    var key = keys[i];
    switch(key) {
      case 'time':
        // Current date and time, from a javascript Date object
        items.push(dcb_entry(43, dateTimeToByteBuffer(data[key])));
        break;
      case 'enabled':
        // General operating status (on/off)
        items.push(dcb_entry(21, data[key] ? 1 : 0));
        break;
      case 'keylock':
        // General operating status (on/off)
        items.push(dcb_entry(22, data[key] ? 1 : 0));
        break;
      case 'holiday':
        // holiday mode
        //   { enabled: false }
        //   { enabled: true, time: new Date() }
        if (('enabled' in data[key]) && !data[key]['enabled']) {
          // Cancel holiday mode
          items.push(dcb_entry(24, 0));
        } else if ('time' in data[key]) {
          // Set return date and time, date without seconds
          data[24] = dateTimeToByteBuffer(data[key]['time']).slice(0,5);
        }
        break;
      case 'runmode':
      case 'run_mode':
        // Run mode (controls heating)
        if (model != 'TM1') {
          var frost = false
          switch(data[key]) {
            case 'frost':
            case 'frost_protection':
              frost = true
              break;
            case 'heating':
              frost = false
              break;
            default:
              throw "run_mode not valid [heating, frost_protection]: " + data[key]
          }
          items.push(dcb_entry(23, frost ? 1 : 0));
        }
        break;
      case 'awaymode':
      case 'away_mode':
        // Away mode (controls hot water) [true, false]
        if (model.match(/(HW|TM1)$/)) {
          var away = (typeof data[key] == 'boolean') ? data[key] : data[key] == 'away'
          items.push(dcb_entry(31, away ? 1 : 0));
        }
        break;
      case 'frostprotect':
        // Frost protection (temperature only, cannot disable)
        if ('target' in data[key]) {
          items.push(dcb_entry(17, data[key]['target']));
        }
        break;
      case 'floorlimit':
        // Floor limit (temperature only, cannot disable)
        if (model.match(/-E$/) && ('floormax' in data[key])) {
          items.push(dcb_entry(19, data[key]['floormax']));
        }
        break;
      case 'heating':
        // Status of heating (target and hold - in minutes - only, cannot turn on/off)
        if (model != 'TM1') {
          if ('target' in data[key]) {
            items.push(dcb_entry(18, data[key]['target']));
          }
          if ('hold' in data[key]) {
            var buf = new Buffer(2);
            buf.writeUInt16LE(data[key]['hold'], 0);
            items.push(dcb_entry(32, buf));
          }
        }
        break;
      case 'hotwater':
        // Status of hot water (values are different from those read)
        if (model.match(/(HW|TM1)$/)) {
          if ('boost' in data[key]) {
            var buf = new Buffer(2);
            buf.writeUInt16LE(data[key]['boost'], 0);
            items.push(dcb_entry(25, buf));
          }
          if ('on' in data[key]) {
            items.push(dcb_entry(42, data[key]['on'] ? 1 : 2));
          }
          else {
            items.push(dcb_entry(42, 0));
          }
        }
        break;
      case 'comfort':
        // Heating comfort levels program
        if (model.match(/^PRT/)) {
          var days = data[key].length
          var days_expected = status.config.progmode == '5/2' ? 2 : 7
          if (days != days_expected) {
            throw "Incorrect number of days specified for comfort levels program " + days + ". Expected " + days_expected;
          }
          for (var day=0;day<days;day++) {
            var comfort;
            for (var entry=0;entry<4;entry++) {
              var row = data[key][day][entry];
              comfort.concat(typeof row !== "undefined" ? timeToByteBuffer(row['time']).push(row['target']) : new Buffer([24,0,16]) );
              var new_schedule = new Buffer([24,0,16]); // default disabled schedule
              if (typeof row !== "undefined") {
                timeToByteBuffer(row['time']).copy(new_schedule);
                new_schedule[2] = row['target'];
              }
              comfort = Buffer.concat(comfort, new_schedule);
            }
            items.push(dcb_entry((days == 2 ? 47 : 103) + day*12, comfort));
          }
        }
        break;
      case 'timer':
        // Hot water control program
        if (model.match(/^(PRTHW|TM1)$/)) {
          var days = data[key].length
          var days_expected = status.config.progmode == '5/2' ? 2 : 7
          if (days != days_expected) {
            throw "Incorrect number of days specified for hot water control program " + days + ". Expected " + days_expected;
          }
          for (var day=0;day<days;day++) {
            var timer;
            for (var entry=0;entry<4;entry++) {
              var row = data[key][day][entry];
              timer.concat(typeof row !== "undefined" ? timeToByteBuffer(row['on']).concat(timeToByteBuffer(row['off'])) : [24,0,24,0] );
            }
            items.push(dcb_entry((days == 2 ? 71 : 187) + day*16, timer));
          }
        }
        break;
      default:
        // HERE - Need to add support for item 26 (TM1 countdown)
        // Other settings are not writable (including basic configuration)
        // Feature 01: $status->{config}->{units}
        // Feature 02: $status->{config}->{switchdiff}
        // Feature 05: $status->{config}->{outputdelay}
        // Feature 06 (06-10): Communications settings
        // Feature 07 (11): $status->{config}->{locklimit}
        // Feature 08 (12): $status->{config}->{sensor}
        // Feature 10 (14): $status->{config}->{optimumstart}
        // Feature 12 (16): $status->{config}->{progmode}
        throw "Unsupported item for writing: " + key;
    }
  }
  callback(items);
}

module.exports = Wifi;
