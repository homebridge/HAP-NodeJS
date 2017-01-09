'use strict';

var AdvertiserAvahi = require('../../../lib/AdvertiserAvahi').Advertiser;
var expect = require('chai').expect;

describe('./lib/AdvertiserAvahi.js', function() {

  var accessoryInfoMock = {
    displayName: 'displayName',
    username: 'username',
    configVersion: 'configVersion',
    category: 'category',
    paired: function() {return true;}
  };

  it('should fail to initialize AdvertiserAvahi when no filepath is defined', function() {
    expect(function() {
      new AdvertiserAvahi({});
    }).to.throw();
  });

  it('should generate avahi xml file', function() {
    var advertiser = new AdvertiserAvahi(accessoryInfoMock, '/path');
    var result = advertiser._createAvahiXmlFile(123);
    expect(result).to.deep.equal('<?xml version="1.0" standalone="no"?><!DOCTYPE service-group SYSTEM "avahi-service.dtd"><service-group><name>displayName</name><service><type>_hap._tcp</type><port>123</port><txt-record>md=displayName</txt-record><txt-record>pv=1.0</txt-record><txt-record>id=username</txt-record><txt-record>c#=configVersion</txt-record><txt-record>s#=1</txt-record><txt-record>ff=0</txt-record><txt-record>ci=category</txt-record><txt-record>sf=0</txt-record></service></service-group>');
  });

  it('should not advertise after initialize', function() {
    var advertiser = new AdvertiserAvahi(accessoryInfoMock, '/path');
    expect(advertiser.isAdvertising()).to.equal(false);
  });

  it('should not throw when stopped advertiser is stopped', function() {
    var advertiser = new AdvertiserAvahi(accessoryInfoMock, '/path');
    advertiser.stopAdvertising();
  });

});
