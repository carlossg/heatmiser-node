#!/usr/bin/env node

var expect = require("expect.js"),
  sinon = require("sinon"),
  net = require('net'),
  Heatmiser = require("../lib/heatmiser");

describe('heatmiser', function(){

  var hm = new Heatmiser('localhost', '0000');

  describe('#Heatmiser()', function(){

    it('should return host, port and pin', function(){
      expect(hm.host).to.be('localhost');
      expect(hm.pin).to.be('0000');
      expect(hm.port).to.be(8068);
    })

  });

  describe('#read_device()', function(){

    it('should read the thermostat', function(done){

      var socket = new net.Socket({});
   
      var stub = sinon.stub(socket, 'write', function (data, encoding, cb) {

        try {
          expect(data.toString('hex')).to.be("930b0000000000ffffda12");
          done();
        } finally {
          // When done make sure you restore stubs to the original functionality.
          net.connect.restore();
          stub.restore();
        }
      });
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

      hm.read_device(function(data) {
        done();
      }, function(error) {
        throw error;
      });
    })

  });
})
