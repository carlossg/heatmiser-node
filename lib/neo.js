"use strict";

var net = require( 'net' );
var util = require( "util" );
var events = require( 'events' );
var ip = require( 'ip' );
var Socket = require( 'net' ).Socket;

function Neo ( host, port ) {
    this.port = (!port) ? 4242 : port;
    var self = this;
    if ( !host ) {
        scanNetwork( this.port, function ( port, host ) {
            self.host = host;
            self.info( function ( data ) {
                self.emit( 'ready', host, port, data.devices );
                events.EventEmitter.call( self );
            } );
        } );
    }
    else {
        this.host = host;
        this.emit( 'ready' );

        events.EventEmitter.call( this );
    }

}

function scanNetwork ( port, callback ) {
    // Create LAN address
    var LAN = ip.address().substr( 0, ip.address().lastIndexOf( '.' ) ) || ip.address();

    // Scan over a range of IP addresses and execute a function each time the PORT is shown to be open.
    for ( var i = 0; i <= 255; i++ ) {

        // Scan local network
        createConnection( port, LAN + '.' + i, function ( err, result ) {
            if ( !err && result ) {
                callback( port, result );
            }
        } );
    }
}

/**
 * This method creates a socket connection to host@port and returns
 * whether this device is listening on port or not.
 * @param port
 * @param host
 * @param checkPort
 * @param callback
 */
var createConnection = function ( port, host, callback ) {
    var socket = new Socket(), error = null, returned = false;

    // Socket connection established, port is open
    socket.on( 'connect', function () {
        returned = true;
        callback( error, host );
        socket.end();
    } );

    // If no response, assume port is not listening
    socket.setTimeout( 1500 );

    // When connection timeout destroy and return
    socket.on( 'timeout', function () {
        error = true;
        socket.destroy();
    } );

    // On error, set status to closed
    socket.on( 'error', function () {
        error = true;
    } );

    // When a socket is closed
    socket.on( 'close', function () {
        if ( !returned ) {
            callback( error, host );
        }
    } );

    // Connect socket to host@port
    socket.connect( port, host );
}

util.inherits( Neo, events.EventEmitter );

var ENCODING = 'ascii';
var FLOAT_FIELDS = [ "CURRENT_FLOOR_TEMPERATURE", "CURRENT_SET_TEMPERATURE", "CURRENT_TEMPERATURE", "MAX_TEMPERATURE", "MIN_TEMPERATURE" ];

// Construct an arbitrary thermostat command
Neo.prototype.command = function ( data, callback ) {
    var self = this;

    var client = net.connect( { host: this.host, port: this.port }, function () { //'connect' listener
        client.write( JSON.stringify( data ), ENCODING );
        client.write( new Buffer( [ 0 ] ) ); // null terminate the string
    } );

    client.setTimeout( 3000 );

    var buffer;
    client.on( 'data', function ( data ) {
        if ( buffer == null ) {
            buffer = data;
        }
        else {
            buffer = Buffer.concat( [ buffer, data ] );
        }
        client.end();
    } );
    client.on( 'timeout', function ( e ) {
        client.end();
        self.emit( 'error', (typeof e === 'undefined') ? new Error( "Timed out" ) : e );
    } );
    client.on( 'error', function ( e ) {
        client.end();
        self.emit( 'error', e );
    } );

    client.on( 'end', function () {
        // strip null byte at the end and parse json
        var data = JSON.parse( buffer.toString( ENCODING, 0, buffer.length - 1 ) );

        // some json floats are set as strings, fix
        if ( data.devices != null ) {
            for ( var i = 0; i < data.devices.length; i++ ) {
                for ( var j = 0; j < FLOAT_FIELDS.length; j++ ) {
                    if ( data.devices[ i ][ FLOAT_FIELDS[ j ] ] != null ) {
                        data.devices[ i ][ FLOAT_FIELDS[ j ] ] = parseFloat( data.devices[ i ][ FLOAT_FIELDS[ j ] ] );
                    }
                }
            }
        }

        if ( typeof callback === 'undefined' ) {
            self.emit( 'success', data );
        }
        else {
            callback( data );
        }
    } );
}

Neo.prototype.info = function ( callback ) {
    this.command( { "INFO": 0 }, callback );
}

Neo.prototype.statistics = function ( callback ) {
    this.command( { "STATISTICS": 0 }, callback );
}

Neo.prototype.zones = function ( callback ) {
    this.command( { "GET_ZONES": 0 }, callback );
}

Neo.prototype.engineersData = function ( callback ) {
    this.command( { "ENGINEERS_DATA": 0 }, callback );
}

Neo.prototype.temperatureLog = function ( deviceNames, callback ) {
    this.command( { "GET_TEMPLOG": deviceNames }, callback );
}

Neo.prototype.timeclock = function ( deviceNames, callback ) {
    this.command( { "READ_TIMECLOCK": deviceNames }, callback );
}

Neo.prototype.comfortLevels = function ( deviceNames, callback ) {
    this.command( { "READ_COMFORT_LEVELS": deviceNames }, callback );
}

Neo.prototype.setComfortLevels = function ( levels, deviceNames, callback ) {
    this.command( { "SET_COMFORT_LEVELS": [ levels, deviceNames ] }, callback );
}

Neo.prototype.setStandby = function ( standby, deviceNames, callback ) {
    var data = {};
    data[ standby ? "FROST_ON" : "FROST_OFF" ] = deviceNames;
    this.command( data, callback );
}

Neo.prototype.setAway = function ( away, deviceNames, callback ) {
    var data = {};
    data[ away ? "AWAY_ON" : "AWAY_OFF" ] = deviceNames;
    this.command( data, callback );
}

Neo.prototype.setHold = function ( id, temperature, hours, minutes, deviceNames, callback ) {
    this.command( {
        "HOLD": [ {
            "temp": temperature,
            "id": id,
            "hours": hours,
            "minutes": minutes
        }, deviceNames ]
    }, callback );
}
Neo.prototype.setTemperature = function ( temperature, deviceNames, callback ) {
    this.command( { "SET_TEMP": [ temperature, deviceNames ] }, callback );
}
Neo.prototype.setSwitchingDifferential = function ( diff, deviceNames, callback ) {
    this.command( { "SET_DIFF": [ diff, deviceNames ] }, callback );
}

module.exports = Neo;
