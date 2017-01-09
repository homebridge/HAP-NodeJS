'use strict';

var debug = require('debug')('Advertiser');
var fs = require('fs');

module.exports = {
  Advertiser: Advertiser
};

function Advertiser(accessoryInfo, filepath) {
  if (!filepath) {
    throw new Error('Avahi filepath not defined!');
  }
  this.accessoryInfo = accessoryInfo;
  this.port = null;
  this.filepath = filepath;
}

Advertiser.prototype._createAvahiXmlFile = function(port) {
  var paired = this.accessoryInfo.paired() ? '0' : '1';
  return '<?xml version="1.0" standalone="no"?>' +
   '<!DOCTYPE service-group SYSTEM "avahi-service.dtd">' +
  '<service-group>' +
    '<name>' + this.accessoryInfo.displayName + '</name>' +
    '<service>' +
      '<type>_hap._tcp</type>' +
      '<port>' + port + '</port>' +
      '<txt-record>md=' + this.accessoryInfo.displayName + '</txt-record>' +
      '<txt-record>pv=1.0</txt-record>' +
      '<txt-record>id=' + this.accessoryInfo.username + '</txt-record>' +
      '<txt-record>c#=' + this.accessoryInfo.configVersion + '</txt-record>' +
      '<txt-record>s#=1</txt-record>' +
      '<txt-record>ff=0</txt-record>' +
      '<txt-record>ci=' + this.accessoryInfo.category + '</txt-record>' +
      '<txt-record>sf=' + paired + '</txt-record>' +
    '</service>' +
  '</service-group>';
};

Advertiser.prototype.startAdvertising = function(port) {
  var xml = this._createAvahiXmlFile(port);
  var self = this;
  fs.writeFile(this.filepath, xml, function(err) {
    if (err) {
      debug('failed to save avahi xml file, ' + err.message);
    } else {
      self.port = port;
    }
  });
};

Advertiser.prototype.isAdvertising = function() {
  return (this.port !== null);
};

Advertiser.prototype.updateAdvertisement = function() {
  if (this.port) {
    this.startAdvertising(this.port);
  } else {
    debug('startAdvertising() not called, ignore');
  }
};

Advertiser.prototype.stopAdvertising = function() {
  fs.unlink(this.filepath, function(err){
		if (err) {
      debug(this.filepath + ' could not deleted: ', err.message);
    }
	});

};
