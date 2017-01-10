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

  it('should get persist env variable, true', function() {
    process.env.PERSIST_TO_DISC = 'true';
    var result = Config.shouldNotPersistToDisk();
    expect(result).to.equal(false);
    delete process.env.PERSIST_TO_DISC;
  });

  it('should get persist env variable, false', function() {
    process.env.PERSIST_TO_DISC = 'false';
    var result = Config.shouldNotPersistToDisk();
    expect(result).to.equal(true);
    delete process.env.PERSIST_TO_DISC;
  });

  it('should get persist env variable, invalid', function() {
    process.env.PERSIST_TO_DISC = 'foo';
    var result = Config.shouldNotPersistToDisk();
    expect(result).to.equal(false);
    delete process.env.PERSIST_TO_DISC;
  });

});
