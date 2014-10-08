var dns_sd = require('./dns_sd')
  , nif = require('./network_interface')
  , util = require('util')
  ;

var MDNSService = require('./mdns_service').MDNSService
  , makeServiceType = require('./service_type').makeServiceType
  ;

function Advertisement(serviceType, port, options, callback) {
  MDNSService.call(this);
  var self = this;

  if ( ! callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
  }
  options = options || {};

  serviceType = makeServiceType(serviceType);

  var flags     = options.flags          || 0
    , ifaceIdx  = nif.interfaceIndex(options)
    , name      = options.name           || null
    , domain    = options.domain         || null
    , host      = options.host           || null
    , txtRecord = options.txtRecord      || null
    , context   = options.context        || null
    ;

  if (txtRecord && typeof txtRecord === 'object' &&
      ! (txtRecord instanceof dns_sd.TXTRecordRef || Buffer.isBuffer(txtRecord)))
  {
    txtRecord = objectToTXTRecord(txtRecord);
  }

  function on_service_registered(serviceRef, flags, errorCode, name,
      serviceType, domain, context)
  {
    var error = dns_sd.buildException(errorCode);
    if (callback) {
      callback.call(self, error, {
          name:    name
        , type:    makeServiceType(serviceType)
        , domain:  domain
        , flags:   flags
      }, context);
    }
    if (error) {
      self.emit('error', error);
    }
  }

  dns_sd.DNSServiceRegister(self.serviceRef, flags, ifaceIdx, name,
      '' + serviceType, domain, host, port, txtRecord, on_service_registered,
      context);
}
util.inherits(Advertisement, MDNSService)
exports.Advertisement = Advertisement;

Advertisement.create = function create(serviceType, port, options, callback) {
  return new Advertisement(serviceType, port, options, callback);
}

function objectToTXTRecord(o) {
  var record = new dns_sd.TXTRecordRef()
    , value
    ;
  record.buffer = new Buffer(256);
  dns_sd.TXTRecordCreate(record, record.buffer);
  for (var p in o) {
    ensure_legal_key(p);
    if (o[p] === undefined || o[p] === null || Buffer.isBuffer(o[p])) {
      value = o[p];
    } else {
      value = '' + o[p];
    }
    dns_sd.TXTRecordSetValue(record, p, value);
  }
  return record;
}

function ensure_legal_key(string) {
  var i, c;
  for (i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 0x20 || c > 0x7e || c === 0x3d) {
      throw new Error("key must be all printable ascii characters exluding '='");
    }
  }
}
