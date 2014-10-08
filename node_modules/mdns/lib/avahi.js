var dns_sd = require('./dns_sd');

function supportsInterfaceIndexLocalOnly() {
  try {
    var sr = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = dns_sd.kDNSServiceInterfaceIndexLocalOnly
      , name   = null
      , type   = '_http._tcp'
      , domain = null
      , host   = null
      , port   = 4321
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister( sr, flags, iface, name, type, domain,
          host, port, txtRec, cb, ctx);
  } catch (ex) {
    if (ex.errorCode === dns_sd.kDNSServiceErr_Unsupported) {
      return false;
    }
    console.warn('Unexpected result while probing for avahi:', ex);
  }
  return true;
}

module.exports = ! supportsInterfaceIndexLocalOnly();
