var st = require('../lib/service_type.js')
  , dns_sd = require('../lib/dns_sd')
  , proxyquire =  require('proxyquire')
  ;

//=== Browser ===========================================================

module.exports["Browser"] = {
  "Should retrieve interface name from cache when interface index is no longer valid": function(test) {
    var callback = null
      , invocations = 0
      , threwException = false
      , interfaceName = "foo"
      , serviceName = "_foo._tcp.";

    var mock_dns_sd = {
      kDNSServiceErr_NoError: dns_sd.kDNSServiceErr_NoError,
      kDNSServiceInterfaceIndexLocalOnly: dns_sd.kDNSServiceInterfaceIndexLocalOnly,
      kDNSServiceFlagsAdd: dns_sd.kDNSServiceFlagsAdd,

      // we stub the if_indextoname method
      if_indextoname: function() {
        invocations++;

        if(invocations == 1) {
          return interfaceName;
        }

        threwException = true;
        throw new Error("Panic!");
      },
      // and stub DNSServiceBrowse to expose a reference to the passed callback
      DNSServiceBrowse: function(sdRef, flags, ifaceIdx, serviceType, domain, on_service_changed, context) {
        callback = function() {
        // pass 1 as the interface index so we don't try to find the name for loopback
          on_service_changed(sdRef, flags, 1, dns_sd.kDNSServiceErr_NoError, serviceName, serviceType, domain, context);
        };
      }
    };

    // we're going to expect two invocations, one where the interface is present and one where it's not
    var serviceDownInvocations = 0;

    // create the browser with our mock of dns_sd
    var browser = proxyquire('../lib/browser.js', { './dns_sd': mock_dns_sd }).Browser.create(serviceName);
    browser.on("serviceDown", function(service) {
      serviceDownInvocations++;

      if(serviceDownInvocations == 1) {
        // first invocation, should have interface name from dns_sd callback
        test.equal(service.networkInterface, interfaceName);

        // should not have thrown an exception yet
        test.ok( ! threwException);
      }

      if(serviceDownInvocations == 2) {
        // second invocation, should have thrown an exception in the callback
        test.ok(threwException);

        // should still have the interface name even though we threw an exception
        test.equal(service.networkInterface, interfaceName);

        test.done();
      }
    });

    // simulate two MDNS events, this will trigger the serviceDown event we listen for above.
    callback();
    callback();
  }
}
