'use strict';

var Config = require('../../../lib/Config');
var expect = require('chai').expect;

describe('./lib/Config.js', function() {

  it('should not use avahi by default', function() {
    var result = Config.useAvahi();
    expect(result).to.equal(false);
  });

  it('should use avahi when env variable is set', function() {
    process.env.AVAHI_TARGET_FILE = 'foo';
    var result = Config.useAvahi();
    expect(result).to.equal(true);
    delete process.env.AVAHI_TARGET_FILE;
  });

  it('should get avahi env variable', function() {
    process.env.AVAHI_TARGET_FILE = 'foo';
    var result = Config.getAvahiFilepath();
    expect(result).to.equal('foo');
    delete process.env.AVAHI_TARGET_FILE;
  });

});
