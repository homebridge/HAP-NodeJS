var mdns_test = require('../utils/lib/mdns_test')
  , mdns      = mdns_test.require('mdns')
  ;

//=== DNSServiceRef ===========================================================

exports['DNSServiceEnumerateDomains'] = function(t) {
  var enumerator = new mdns.MDNSService();
  var timeout = setTimeout(function() {
    console.log('[SKIPPED] probably running on ahavi');
    enumerator.stop();
    t.done()
  }, 10000);
  function on_enum(sref, flags, iface, error, domain, context) {
    t.strictEqual(error, mdns.kDNSServiceErr_NoError, "error must be NoError");
    t.strictEqual(typeof flags, 'number', "'flags' must be of type number");
    t.strictEqual(typeof iface, 'number', "'iface' must be of type number");

    enumerator.stop();
    clearTimeout(timeout);
    t.done();
  }
  mdns.dns_sd.DNSServiceEnumerateDomains(enumerator.serviceRef,
      mdns.kDNSServiceFlagsBrowseDomains, 0, on_enum, {some: 'context'});
  enumerator.start();
}

