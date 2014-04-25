#!/usr/bin/env node

var expect = require("expect.js"),
  sinon = require("sinon"),
  net = require('net'),
  heatmiser = require("../lib/heatmiser");

describe('heatmiser wifi', function(){

  // pin in hex little endian: 0xd204
  var hm = new heatmiser.Wifi('localhost', 1234, 8068, 'PRT-E');

  // stub sockets
  var stub = null;
  var socket = null;

  beforeEach(function(){
    socket = new net.Socket({});   
    sinon.stub(socket, 'setTimeout');

    socket.on('data', function(data) {
      // data.should.eql('foo');
      // test is done or it will timeout and fail
      // done();
    });

    // Stub the net.connect function
    sinon.stub(net, 'connect');
    // Asynchronously call the second argument with a null error and some text when passed certain arguments
    net.connect.callsArgWithAsync(1).returns(socket);

    hm.on('success', function(data) {});
    hm.on('error', function(error) { throw error; });
  })

  // When done make sure you restore stubs to the original functionality.
  afterEach(function(){
    net.connect.restore();
    if (stub != null) stub.restore();    
  })

  describe('#Heatmiser()', function(){

    it('should return host, port and pin', function(){
      expect(hm.host).to.be('localhost');
      expect(hm.pin).to.be(1234);
      expect(hm.port).to.be(8068);
    })

  });

  describe('#read_device()', function(){

    it('should read the thermostat', function(done){

      stub = sinon.stub(socket, 'write', function (data, encoding, cb) {

        // operation: 0x93
        // data length: 0x0b00
        // pin: 0xd204
        // data: 0x0000ffff
        // checksum: 0x28b4
        expect(data.toString('hex')).to.be("930b00d2040000ffff28b4");
        done();
      });

      hm.read_device();
    })

  });


  describe('#write_device()', function(){

    it('should set the thermostat time', function(done){

      stub = sinon.stub(socket, 'write', function (data, encoding, cb) {

        // operation: 0xA3
        // data length: 0x1200
        // pin: 0xD204
        // items: 0x01
        // data => position: 0x2B00 size: 0x07 data: 0x0D0C1903132601 (13-12-25 wed 19:38:01)
        // checksum: 0x3E1C
        expect(data.toString('hex')).to.be("A31200D204012B00070D0C19031326013E1C".toLowerCase());
        done();
      });

      var dcb = {
        time: new Date(2013,11,25,19,38,01)
      }

      hm.write_device(dcb);
    })

    it('should set the thermostat to frost mode (away)', function(done){

      stub = sinon.stub(socket, 'write', function (data, encoding, cb) {

        // operation: 0xA3
        // data length: 0x0C00
        // pin: 0xD204
        // items: 0x01
        // data => position: 0x1700 size: 0x01 data: 0x01 (frost)
        // checksum: 0x38DC
        expect(data.toString('hex')).to.be("A30C00D204011700010138DC".toLowerCase());

        done();
      });

      var dcb = {
        runmode: 'frost_protection'
      }

      hm.write_device(dcb);
    })

    it('should set the thermostat to temperature hold and limit floor', function(done){

      stub = sinon.stub(socket, 'write', function (data, encoding, cb) {

        // operation: 0xA3
        // data length: 0x1500
        // pin: 0xD204
        // items: 0x03
        // data => 
        //   position: 0x1200 size: 0x01 data: 0x14 (20C)
        //   position: 0x2000 size: 0x02 data: 0x1E00 (30 minutes)
        //   position: 0x1300 size: 0x01 data: 0x17 (23 C)
        // checksum: 0x6CC1
        expect(data.toString('hex')).to.be("A31500D20403120001142000021E00130001176CC1".toLowerCase());

        done();
      });

      var dcb = {
        heating: {
          target: 20, // C
          hold: 30 // minutes
        },
        floorlimit: {
          floormax: 23
        }
      }

      hm.write_device(dcb);
    })

  });
})
