"use strict";

const EventEmitter = require('events').EventEmitter;
const net = require('net');
const rtsp = require('rtsp-stream');
const url = require('url');
const HTTPAuthenticate = require('./HTTPAuthenticate');
const SDPTransform = require('sdp-transform');
const dns = require('dns');

class RTSPClient extends EventEmitter {
  constructor(urlString) {
    super();

    let self = this;

    let parsed = url.parse(urlString);

    let auth = parsed.auth;
    parsed.auth = null;

    let authParts = auth.split(':', 2);
    self.username = authParts[0];
    self.password = authParts[1];
    self.authenticate = new HTTPAuthenticate(self.username, self.password);

    self.hostname = parsed.hostname;
    self.port = parsed.port || 554;

    self.sanitizedURI = url.format(parsed);

    self.decoder = new rtsp.Decoder();
    self.encoder = new rtsp.Encoder();

    self.requests = {};
    self.cseq = 1;
    self.session = null;

    self.socket = net.createConnection(self.port, self.hostname, function() {
      self.getSDP();
    });

    self.socket.pipe(self.decoder);
    self.encoder.pipe(self.socket);

    self.decoder.on('response', function(response) {
      self.onResponse(response);
    });
  }

  onResponse(response) {
    let self = this;
    let cseq = parseInt(response.headers['cseq']);
    let request = self.requests[cseq];
    if(!request)
      return;

    request.chunks = [];
    response.on('data', function(data) {
      request.chunks.push(data);
    });

    let done = function() {
      let requestOptions = request.options;
      let callback = request.callback;

      delete self.requests[cseq];

      if(response.statusCode == 401 && !requestOptions.headers['Authorization'] && response.headers['www-authenticate']) {
        self.authenticate.parseHeaderValue(response.headers['www-authenticate']);
        self.makeRequest(requestOptions, callback);
        return;
      }

      callback(response, Buffer.concat(request.chunks));
    };

    if(response.headers['session']) {
      let parts = response.headers['session'].split(';');
      self.session = parts[0];
    }

    if(response.headers['content-length'] && parseInt(response.headers['content-length']) > 0)
      response.on('end', done);
    else
      done();
  }

  makeRequest(options, callback) {
    let self = this;
    let cseq = self.cseq++;

    if(!options.headers)
      options.headers = {};

    options.headers['CSeq'] = cseq;
    if(self.authenticate.ready())
      options.headers['Authorization'] = self.authenticate.response(options.method, options.uri);

    if(self.session)
      options.headers['Session'] = self.session;

    let request = self.encoder.request(options);
    self.requests[cseq] = {options: options, callback: callback};
    request.end();
  }

  codecForPayload(payload) {
    switch(payload) {
      case 0:
        return 'PCMU';
      case 8:
        return 'PCMA';
      default:
        return 'UNKNOWN';
    }
  }

  getSDP() {
    let self = this;
    self.makeRequest({method: 'DESCRIBE', uri: self.sanitizedURI, }, function(response, data) {
      let sdp = SDPTransform.parse(data.toString('utf8'));
      for(let medium of sdp.media) {
        let payloads = medium.payloads.toString().split(' ');
        let payload = parseInt(payloads[0]);

        let codec;
        if(payload >= 96) {
          for(let rtp of medium.rtp) {
            if(rtp.payload == payload && rtp.codec) {
              codec = rtp.codec;
              break;
            }
          }
        } else {
          codec = self.codecForPayload(payload);
        }

        let uri;
        if(medium.control) {
          uri = url.resolve(self.sanitizedURI + '/', medium.control);
        } else {
          uri = self.sanitizedURI;
        }

        let descriptor = {
          payload: payload,
          codec: codec,
          uri: uri
        };

        if(medium.type == 'video' && !self.video) {
          self.video = descriptor;
        }

        if(medium.type == 'audio' && !self.audio) {
          self.audio = descriptor;
        }
      }

      self.emit('sdp', sdp);
    });
  }

  setup(uri, rtpPort, rtcpPort) {
    let self = this;
    return new Promise(function(resolve, reject) {
      self.makeRequest({
        method: 'SETUP',
        uri: uri,
        headers: {
          'Transport': 'RTP/AVP;unicast;client_port=' + rtpPort.toString() + '-' + rtcpPort.toString()
        }
      }, function(response, data) {
        let transport = response.headers['transport'];
        if(!transport) {
          self.emit('error', { message: 'No transport.' });
          return;
        }

        let source = null;
        let rtpPort = null;
        let rtcpPort = null;

        for(let value of transport.split(';')) {
          let parts = value.split('=', 2);
          if(parts.length != 2)
            continue;

          if(parts[0] == 'server_port') {
            let ports = parts[1].split('-', 2);
            rtpPort = parseInt(ports[0]);
            if(ports.length == 2)
              rtcpPort = parseInt(ports[1]);
            else
              rtcpPort = rtpPort;
          } else if(parts[0] == 'source') {
            source = parts[1];
          }
        }

        if(source && rtpPort && rtcpPort) {
          dns.resolve(source, function(err, addresses) {
            if(addresses.length == 0) {
              reject();
              return;
            }

            resolve({
              source: addresses[0],
              rtpPort: rtpPort,
              rtcpPort: rtcpPort
            });
          });
        } else {
          reject();
        }
      });
    });
  }

  play() {
    let self = this;
    self.makeRequest({
      method: 'PLAY',
      uri: self.sanitizedURI
    }, function(response, data) {
      self.emit('play');
    });
  }

  pause() {
    let self = this;
    self.makeRequest({
      method: 'PAUSE',
      uri: self.sanitizedURI
    }, function(response, data) {
      self.emit('pause');
    });
  }

  teardown() {
    let self = this;
    self.makeRequest({
      method: 'TEARDOWN',
      uri: self.sanitizedURI
    }, function(response, data) {
      self.emit('teardown');
      self.session = null;
    });
  }

}

module.exports = RTSPClient;
