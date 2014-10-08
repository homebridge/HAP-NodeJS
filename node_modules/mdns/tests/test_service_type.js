var mdns_test = require('../utils/lib/mdns_test')
  , mdns      = mdns_test.require('mdns')
  ;

exports['protocol helpers'] = function(t) {
  t.strictEqual( mdns.udp('osc').toString(), '_osc._udp',
      'comparing simple udp service type');

  t.strictEqual( mdns.tcp('http', 'blogapi').toString(), '_http._tcp,_blogapi',
      'comparing tcp service type with subtype');
  t.strictEqual( mdns.tcp('http', 'blogapi', 'newblogapi').toString(),
      '_http._tcp,_blogapi,_newblogapi',
      'comparing tcp service types with two subtypes');

  t.done();
}

function compareServiceType() {
  var args = Array.prototype.slice.call(arguments)
    , t = args.shift()
    , msg = args.pop()
    , str = args.pop()
    , type = mdns.makeServiceType.apply(this, args)
    ;
  t.strictEqual(type.toString(), str, msg);
}

var http_type = '_http._tcp,_foo,_bar';

exports['makeServiceType()'] = function(t) {

  compareServiceType(t, http_type, http_type,
      'construct from string form');
  compareServiceType(t, 'http', 'tcp', 'foo', 'bar', http_type,
      'construct from tokens');
  compareServiceType(t, '_http', '_tcp', '_foo', '_bar', http_type,
      'construct from tokens with underscores');
  compareServiceType(t, ['http', 'tcp', 'foo', 'bar'], http_type,
      'construct from array');
  compareServiceType(t, mdns.tcp('http', 'foo', 'bar'), http_type,
      'construct with protocol helper');
  compareServiceType(t,
    { name: 'http'
    , protocol: 'tcp'
    , subtypes: ['foo', 'bar']
    }
    , http_type,
    'construct from object (json)');

  t.done();
}


exports['json round-trip'] = function(t) {
  compareServiceType(t, mdns.makeServiceType(
        JSON.parse(JSON.stringify(mdns.makeServiceType(http_type))))
      , http_type,
      'construct from result of JSON.parse(JSON.stringify(...))');

  t.done();
}

exports['ServiceType() constructor'] = function(t) {
  compareServiceType(t, new mdns.ServiceType('http', 'tcp', 'foo', 'bar'),  http_type,
      'construct from tokens');
  compareServiceType(t, new mdns.ServiceType(['http', 'tcp', 'foo', 'bar']), http_type,
      'construct from array');
  compareServiceType(t, new mdns.ServiceType({name: 'http', protocol: 'tcp', subtypes: ['foo', 'bar']}), http_type,
      'construct from object');

  t.done();
}

exports['illegal arguments'] = function(t) {
  t.throws(function() { mdns.tcp('abcdefghijklmnopq') },
      'service type to long');
  t.throws(function() { mdns.tcp('abc%') },
      'illegal characters in primary type');
  t.throws(function() { mdns.tcp('abc', 'abcdefghijklmnopq') },
      'subtype to long');
  t.throws(function() { mdns.tcp('abc', '%$@') },
      'illegal characters in subtype');
  t.throws(function() { mdns.tcp('abc', 'def', 'foo_bar') },
      'illegal chars in subtype');

  t.throws(function() { mdns.tcp('abc', 'tcp', 'foo') },
      'type token already present');

  t.throws(function() { mdns.makeServiceType({}) },
      'missing properties');
  t.throws(function() { mdns.makeServiceType({name: 'foo', protocol: 'bar'}) },
      'illegal protocol');
  t.throws(function() { mdns.makeServiceType(5) },
      'attempt to construct from number');
  t.throws(function() { mdns.tcp('') },
      'aatempt to construct with an empty string');

  t.done();
}

// vim: filetype=javascript:
