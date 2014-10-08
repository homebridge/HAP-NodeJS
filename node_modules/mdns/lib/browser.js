var dns_sd = require('./dns_sd')
  , nif = require('./network_interface')
  , util = require('util')
  , rst = require('./resolver_sequence_tasks')
  , st = require('./service_type')
  , MDNSService = require('./mdns_service').MDNSService
  ;

var Browser = exports.Browser = function Browser(serviceType, options) {
  MDNSService.call(this);
  var self = this;

  options = options || {};
  var flags = options.flags             || 0
    , ifaceIdx  = nif.interfaceIndex(options)
    , domain = options.domain           || null
    , context = options.context         || null
    , requested_type = st.makeServiceType( serviceType );
    ;

  var interfaceNames = [];

  function on_service_changed(sdRef, flags, ifaceIdx, errorCode, serviceName,
      serviceType, replyDomain, context)
  {
    function on_resolver_done(error, service) {
      if (error) {
        self.emit('error', error, service);
      } else {
        self.emit('serviceChanged', service, context);
        self.emit('serviceUp', service, context);
      }
    }
    if (errorCode == dns_sd.kDNSServiceErr_NoError) {
      if (requested_type.isWildcard()) {
        serviceType = serviceName + '.' + serviceType.split('.').shift();
        serviceName = null;
      }
      var service = {
          interfaceIndex: ifaceIdx
        , type: st.makeServiceType(serviceType)
        , replyDomain: replyDomain
        , flags: flags
      };
      if (serviceName) service.name    = serviceName;

      if (dns_sd.kDNSServiceInterfaceIndexLocalOnly === ifaceIdx) {
        service.networkInterface = nif.loopbackName();
      } else if (typeof dns_sd.if_indextoname !== 'undefined' && ifaceIdx > 0) {
        try {
          service.networkInterface = dns_sd.if_indextoname(ifaceIdx);

          interfaceNames[ifaceIdx] = service.networkInterface;
        } catch(e) {
          if(typeof interfaceNames[ifaceIdx] !== "undefined") {
            service.networkInterface = interfaceNames[ifaceIdx];
          } else {
            throw e;
          }
        }
      }

      if (flags & dns_sd.kDNSServiceFlagsAdd) {
        resolve(service,
            options.resolverSequence || Browser.defaultResolverSequence,
            on_resolver_done);
      } else {
        self.emit('serviceChanged', service, context);
        self.emit('serviceDown', service, context);
      }
    } else {
      self.emit('error', dns_sd.buildException(errorCode));
    }
  }

  dns_sd.DNSServiceBrowse(self.serviceRef, flags, ifaceIdx, '' + requested_type,
      domain, on_service_changed, context);
}
util.inherits(Browser, MDNSService);

var resolve = exports.resolve = function resolve(service, sequence, callback) {
  var step = 0;
  if ( ! callback) {
    callback = sequence;
    sequence = Browser.defaultResolverSequence;
  }

  function next(error) {
    if (error) {
      callback(error, service);
      return;
    }
    if (sequence.length === step) {
      callback(undefined, service);
      return;
    }
    sequence[step++](service, next);
  }

  next();
}

Browser.create = function create(serviceType, options) {
  return new Browser(serviceType, options);
}

Browser.defaultResolverSequence = [
  rst.DNSServiceResolve()
, 'DNSServiceGetAddrInfo' in dns_sd ? rst.DNSServiceGetAddrInfo() : rst.getaddrinfo()
, rst.makeAddressesUnique()
];

exports.browseThemAll = function browseThemAll(options) {
  options = options || {}
  options.resolverSequence = options.resolverSequence || [];
  return Browser.create(st.ServiceType.wildcard, options);
}

