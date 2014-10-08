var path = require('path')
  , mdns_test    = require('../utils/lib/mdns_test')
  , dns_sd       = mdns_test.require('dns_sd')
  , service_type = "_mdns_test._tcp"
  , test_port    = 4321
  ;

//=== DNSServiceRef ===========================================================

exports['DNSServiceRef'] = function(t) {
  
  var sr = new dns_sd.DNSServiceRef();

  t.ok(sr,
      'DNSServiceRef must be truthy');
  t.strictEqual(sr.fd, -1,
      'File descriptor must be -1');
  t.strictEqual(sr.initialized, false,
      'DNSServiceRef must not be initialized');
  t.done();
}

//=== DNSServiceRegister ======================================================

exports['DNSServiceRegister()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  t.doesNotThrow(function() {
    var /* uses paren scope serviceRef */
        flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister( serviceRef, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  'Call with minimal argumentss must succeed.');

  t.notStrictEqual(serviceRef.fd, -1,
      'File descriptor must not be -1 after initialization');

  t.strictEqual(serviceRef.initialized, true,
      'DNSServiceRef must be initialized');

  t.throws(function() {
    var /* uses parent scope serviceRef */
        flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister( serviceRef, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  'Duplicate initialization of DNSServiceRef must throw');

  t.doesNotThrow(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = 'My sh4red stuff'
      , type   = service_type
      , domain = 'somedomain'
      , host   = null /* avahi throws 'bad param'*/
      , port   = test_port
      , txtRec = new Buffer('\0')
      , cb     = function() {}
      , ctx    = {anything: true}
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  'Call with all arguments on must succed.');

  t.throws(function() { dns_sd.DNSServiceRegister(); },
      'Call with zero arguments must throw.');

  t.throws(function() {
    var a1, a2, a3, a4, a5, a6, a7, a8;
    dns_sd.DNSServiceRegister(a1, a2, a3, a4, a5, a6, a7, a7);
  },  'Call with eight arguments must throw.');

  t.throws(function() {
    var ref    = { not_a_service_ref: true } /* broken */
      , flags  = 0 
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'flags' must be a number, not a string.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = '=== KAPUTT ===' /* broken */
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'flags' must be a number, not a string.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = '=== KAPUTT ===' /* broken */
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'interfaceIndex' must be a number, not a string.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = 1111111111 /* broken */
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'name' must be a string, not a number.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = null /* broken */
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'regtype' must be a string, not null.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = 1111111111 /* broken */
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'regtype' has to be a string, not a number.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = 1111111111 /* broken */
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'domain' must not be a string, not a number.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = 1111111111 /* broken */
      , port   = test_port
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'host' must be a string, not a number.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = '=== KAPUTT ===' /* broken */
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'port' must be a number, not a string.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = 1111111111 /* broken */
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'txtRecord' must be a TXTRecordRef or buffer, not a number.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = test_port
      , txtRec = null
      , cb     = '=== KAPUTT ===' /* broken */
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  "'callback' must be a function, not a string.");

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = 1 << 16 /* broken */
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  'port number must be <= ' + ((1 << 16) - 1) + '.');

  t.throws(function() {
    var ref    = new dns_sd.DNSServiceRef()
      , flags  = 0
      , iface  = 0
      , name   = null
      , type   = service_type
      , domain = null
      , host   = null
      , port   = -1    /* broken */
      , txtRec = null
      , cb     = null
      , ctx    = null
      ;
    dns_sd.DNSServiceRegister(ref, flags, iface, name, type, domain,
      host, port, txtRec, cb, ctx);
  },  'port number must >= 0.');

  t.done();
};

//=== DNSServiceProcessResult =================================================

exports['DNSServiceProcessResult()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef()
    , IOWatcher  = require('../lib/io_watcher').IOWatcher
    , watcher    = new IOWatcher()
    , timeout    = 3000
    , timeoutId  = setTimeout(function() {
        t.ok(false ,"Test did not finish within " + (timeout/1000) + "s");
        watcher.stop();
        t.done();
      }
      , timeout);

  t.throws(function() {
    dns_sd.DNSServiceProcessResult();
  });

  t.throws(function() {
    dns_sd.DNSServiceProcessResult('flip', 'flap', 'flop');
  });

  t.throws(function() {
    dns_sd.DNSServiceProcessResult(new dns_sd.DNSServiceRef());
  });

  t.throws(function() {
    dns_sd.DNSServiceProcessResult(5);
  });

  watcher.callback = function() {
    dns_sd.DNSServiceProcessResult(serviceRef);
  }

  function result_callback(sdRef, flags, errorCode, name, serviceType, domain,
      context)
  {
    t.strictEqual(sdRef, serviceRef,
        'serviceRef must be identical');
    t.strictEqual(typeof flags, "number",
        "'flags' must be of type number");
    t.strictEqual(typeof errorCode, "number",
        "'errorCode' must be of type number");
    t.strictEqual(errorCode, dns_sd.kDNSServiceErr_NoError,
        "'errorCode' must be kDNSServiceErr_NoError");
    t.strictEqual(typeof name, "string",
        "'name' must be of type string");
    t.strictEqual(typeof serviceType, "string",
        "'serviceType' must be of type string");
    t.strictEqual(typeof domain, "string",
        "'domain' must be of type string");
    t.strictEqual(typeof context, "string",
        "'context' must be of type string (in this test)");
    t.strictEqual(context, "foobar",
      "expected 'foobar' but got '" + context + "'");

    clearTimeout(timeoutId);
    watcher.stop();
    watcher.callback = null;
    t.done();
  }

  dns_sd.DNSServiceRegister(serviceRef, 0, 0, null, service_type,
      null, null, test_port, null, result_callback, "foobar");

  watcher.set(serviceRef.fd, true, false);
  watcher.start();
}

//=== DNSServiceRefSockFD =====================================================

exports['DNSServiceRefSockFD()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  t.throws(function() {dns_sd.DNSServiceRefSockFD(serviceRef)},
      'call with uninitialized serviceRef must throw');

  dns_sd.DNSServiceRegister(serviceRef, 0, 0, null, service_type,
      null, null, test_port, null, null, null);

  var fd;
  t.doesNotThrow(function() {fd = dns_sd.DNSServiceRefSockFD(serviceRef)},
    "DNSServiceRefSockFD() must not throw");

  t.notEqual(fd, -1, 'file descriptor must not be -1');

  t.strictEqual(serviceRef.fd, fd,
      'result of DNSServiceRefSockFD() and fd getter must be the same');

  t.throws(function() { dns_sd.DNSServiceRefSockFD("narf"); },
      'argument must be a DNSServiceRef');

  t.throws(function() { dns_sd.DNSServiceRefSockFD(); },
      'must throw when called with not enough arguments');

  t.done();
}

//=== DNSServiceBrowse ========================================================

exports['DNSServiceBrowse()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  t.doesNotThrow(function() {
    dns_sd.DNSServiceBrowse(serviceRef, 0, 0, service_type, null,
      function() {}, null);
  }, "DNSServiceBrowse() must not throw");

  t.throws(function() {
    dns_sd.DNSServiceBrowse(serviceRef, 0, 0, service_type, null,
      function() {}, null);
  },  'serviceRef already initialized');

  t.throws(function() {
    dns_sd.DNSServiceBrowse();
  }, 'not enough arguments');

  t.throws(function() {
    dns_sd.DNSServiceBrowse("", 0, 0, service_type, null,
      function() {}, null);
  }, "'serviceRef' must not be a string");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, "", 0, service_type, null,
      function() {}, null);
  }, "'flags' must be a number, not a string");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, "", service_type, null,
      function() {}, null);
  }, "'interfaceIndex' must be a number, not a string");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, null, null, function() {}, null);
  }, "'regtype' must be a string, not null");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, 0, null, function() {}, null);
  }, "'regtype' must be a string, not a number");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, service_type, 0,
      function() {}, null);
  }, "'domain' must be a string, not a number");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, service_type, null, 0, null);
  }, "'callback' must be a function, not a number");

  // coverage: take domain branch
  t.doesNotThrow(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, service_type, 'somedomain',
      function() {}, null);
  }, "DNSServiceBrowse() must not throw");

  // coverage: take domain undefined branch
  t.doesNotThrow(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, service_type, undefined,
      function() {}, null);
  }, "DNSServiceBrowse() must not throw");

  // coverage: take domain undefined branch
  t.doesNotThrow(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceBrowse(ref, 0, 0, service_type, undefined,
      function() {}, undefined);
  }, "DNSServiceBrowse() must not throw");

  t.done();
}

//=== DNSServiceRefDeallocate =================================================

exports['DNSServiceRefDeallocate()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  dns_sd.DNSServiceRegister(serviceRef, 0, 0, null, "_node-mdns-test._tcp",
      null, null, test_port, null, null, null);

  t.strictEqual(serviceRef.initialized, true,
      "'initialized' must be true after inititalization");

  dns_sd.DNSServiceRefDeallocate(serviceRef);

  t.strictEqual(serviceRef.initialized, false,
      "'initialized' must be false after deallocation");

  t.strictEqual(serviceRef.fd, -1,
      "'fd' must be -1 after deallocation");

  t.throws(function() { dns_sd.DNSServiceRefDeallocate(serviceRef); },
      "serviceRef is already deallocated");

  t.throws(function() { dns_sd.DNSServiceRefDeallocate(); },
      "not enough arguments");

  t.throws(function() { dns_sd.DNSServiceRefDeallocate(undefined); },
      "argument must be DNSServiceRef, not undefined");

  t.throws(function() { dns_sd.DNSServiceRefDeallocate(serviceRef, serviceRef); },
      "to many arguments");

  t.throws(function() { dns_sd.DNSServiceRefDeallocate({foo: 'bar'}); },
      "call with non serviceRef object must throw");

  t.done();
}

//=== DNSServiceResolve =======================================================

exports['DNSServiceResolve()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  t.doesNotThrow(function() {
    dns_sd.DNSServiceResolve(serviceRef, 0, 0, 'hostname',
      service_type, 'local.', function() {}, null);
  }, 'DNSServiceResolve() must not throw');

  t.strictEqual(serviceRef.initialized, true,
      "'initialized' must be true after inititalization");

  t.throws(function() {
    dns_sd.DNSServiceResolve(serviceRef, 0, 0, undefined,
      service_type, 'local.', function() {}, null);
  }, 'duplicate initialization must throw');

  t.throws(function() {
    dns_sd.DNSServiceResolve();
  }, "not enough arguments");

  t.throws(function() {
    dns_sd.DNSServiceResolve({not_a_service_re: true}, 0, 0, 'hostname',
      service_type, 'local.', function() {}, null);
  }, 'serviceRef must be DNSServiceRef object');

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, "", 0, 'hostname',
      service_type, 'local.', function() {}, null);
  }, "'flags' must be a number, not a string");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, 0, null, 'hostname',
      service_type, 'local.', function() {}, null);
  }, "'interfaceIndex' must be a number, not null");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, 0, 0, null,
      service_type, 'local.', function() {}, null);
  }, "'name' must be a string, not null");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, 0, 0, 'hostname', null,
      'local.', function() {}, null);
  }, "'regtype' must be a string, not null");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, 0, 0, 'hostname',
      service_type, null, function() {}, null);
  }, "'domain' must be a string, not null");

  t.throws(function() {
    var ref = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceResolve(ref, 0, 0, 'hostname',
      service_type, 'local.', null, null);
  }, "'callback' must be a function, not null");

  t.done();
}

//=== DNSServiceEnumerateDomains ==============================================

exports['DNSServiceEnumerateDomains()'] = function(t) {
  var serviceRef = new dns_sd.DNSServiceRef();

  t.doesNotThrow( function() {
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, function() {}, null);
  }, 'DNSServiceEnumerateDomains() must not throw');

  t.notEqual(serviceRef.fd, -1,
      "'fd' must not be -1 after inititalization");
  t.strictEqual(serviceRef.initialized, true,
      "'initialized' must be true after inititalization");

  t.doesNotThrow( function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, function() {}, undefined);
  }, 'DNSServiceEnumerateDomains() must not throw');

  t.doesNotThrow( function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, function() {}, {some: 'context'});
  }, 'DNSServiceEnumerateDomains() must not throw');

  t.throws(function() {
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, function() {}, null);
  }, 'dupliate inititalization of serviceRef must throw');

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      'flags', 0, function() {}, null);
  }, "'flags' must be a number, not a string");

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      0, 0, function() {}, null);
  }, "'flags' must be kDNSServiceFlagsBrowseDomains or " +
     "kDNSServiceFlagsRegistrationDomains");

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 'interfaceIndex', function() {}, null);
  }, "'interfaceIndex' must be number, not a string");

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, 'function', null);
  }, "'callback' must be function, not a string");

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains(serviceRef,
      dns_sd.kDNSServiceFlagsBrowseDomains, 0, null, null);
  }, "'callback' must be function, not null");

  t.throws(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceEnumerateDomains();
  }, "not enough arguments");

  t.throws(function() {
    dns_sd.DNSServiceEnumerateDomains('not a serviceRef',
      0, 0, function() {}, null);
  }, "serviceRef must be a DNSServiceRef object");

  t.done();
}

//=== DNSServiceGetAddrInfo ===================================================

function findInterfaceIndex() {
  var serviceRef, i;
  for (var i = 0; i < 100; ++i) {
    try {
      serviceRef = new dns_sd.DNSServiceRef();
      dns_sd.DNSServiceGetAddrInfo(serviceRef, 0, i, 0, 'somehost.local.',
          function() {}, null);
      return i;

    } catch (ex) {}
  }
}

exports['DNSServiceGetAddrInfo'] = function DNSServiceGetAddrInfo(t) {

  if ( ! dns_sd.DNSServiceGetAddrInfo) {
    console.log('[SKIPPED] DNSServiceGetAddrInfo() not available');
    t.done();
    return;
  }

  var iface = findInterfaceIndex();

  t.doesNotThrow(function() {
    var serviceRef = new dns_sd.DNSServiceRef();
    dns_sd.DNSServiceGetAddrInfo(serviceRef, 0, iface, 0, 'somehost.local.',
      function() {}, null);
  }, 'DNSServiceGetAddrInfo() must not throw');

  // TODO add more tests

  t.done();
}

//=== TXTRecordRef ============================================================

exports['TXTRecordRef'] = function(t) {
  var txtRecord = new dns_sd.TXTRecordRef()
    , uninitialized_txt_record = new dns_sd.TXTRecordRef()
    ;
  dns_sd.TXTRecordCreate(txtRecord, null);

  var txtRecord = new dns_sd.TXTRecordRef();
  var buffer = new Buffer(256);
  dns_sd.TXTRecordCreate(txtRecord, buffer);
  txtRecord.buffer = buffer;

  dns_sd.TXTRecordSetValue(txtRecord, 'foo', 'bar');
  t.strictEqual(dns_sd.TXTRecordGetLength(txtRecord), 8,
      "length must be 8 bytes after adding 'foo=bar'");

  dns_sd.TXTRecordSetValue(txtRecord, 'foobar', 'foobar');
  t.strictEqual(dns_sd.TXTRecordGetLength(txtRecord), 22,
      "length must be 22 bytes after adding 'foobar=foobar'");

  dns_sd.TXTRecordSetValue(txtRecord, 'buffer', new Buffer('raw'));
  t.strictEqual(dns_sd.TXTRecordGetLength(txtRecord), 33,
      "length must be 33 bytes after adding 'buffer=raw'");

  t.throws(function() { dns_sd.TXTRecordCreate() },
      'TXTRecordCreate() must throw when called without arguments');
  t.throws(function() { dns_sd.TXTRecordCreate('narf') },
      'TXTRecordCreate() must throw when called with a string');
  t.throws(function() { dns_sd.TXTRecordCreate(txtRecord) },
      'duplicate call to TXTRecordCreate() must throw');
  t.throws(function() {
    var b = new Buffer(256);
    dns_sd.TXTRecordCreate({not_a_txt_record: true}, b);
  }, 'txtRecord must be a TXTRecordRef object');
  t.throws(function() {
    var b = new Buffer(256);
    dns_sd.TXTRecordCreate(5, b);
  }, 'txtRecord must be a TXTRecordRef object');
  t.doesNotThrow(function() {
    var tref = new dns_sd.TXTRecordRef();
    dns_sd.TXTRecordCreate(tref, undefined);
  },'TXTRecordCreate() with undefined buffer must succeed');
  t.throws(function() {
    var tref = new dns_sd.TXTRecordRef();
    dns_sd.TXTRecordCreate(tref, {not_a_buffer: true});
  }, 'illegal buffer argument must throw');
  t.throws(function() {
    var tref = new dns_sd.TXTRecordRef();
    dns_sd.TXTRecordCreate(tref, 5);
  }, 'illegal buffer argument must throw');


  t.throws(function() { 
    dns_sd.TXTRecordDeallocate({not_a_txt_record_ref: true})
  }, 'illegal argument must throw');

  t.throws(function() { 
    dns_sd.TXTRecordDeallocate(5)
  }, 'illegal argument must throw');

  t.throws(function() { dns_sd.TXTRecordSetValue()},
    'TXTRecordSetValue() must throw when called without arguments');
  t.throws(function() { dns_sd.TXTRecordSetValue(5, null, null)},
    'TXTRecordSetValue() must throw when called with non TXTRecordRef object');
  t.throws(function() { dns_sd.TXTRecordSetValue({not_a_txt_record: true}, null, null)},
    'TXTRecordSetValue() must throw when called with non TXTRecordRef object');
  t.throws(function() {
      dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), {not_a_string: true}, null)
  }, 'TXTRecordSetValue() must throw when called with non TXTRecordRef object');

  // XXX avahi doesn't like these. replace with real tests when txt records are
  //     implemented in javascript
  try {
    dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'foo', null);
    t.doesNotThrow(function() {
        dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'foo', null)
    }, 'TXTRecordSetValue() must not throw when called with null value');
  } catch (ex) {
    console.log("[SKIPPED] avahi doesn't support null values");
  }
  try {
    dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'foo', undefined);
    t.doesNotThrow(function() {
        dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'foo', undefined)
    }, 'TXTRecordSetValue() must not throw when called with undefined value');
  } catch (ex) {
    console.log("[SKIPPED] avahi doesn't support undefined values");
  }
  t.throws(function() {
      dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 5, undefined)
  }, 'TXTRecordSetValue() must throw when called with non string key');
  t.throws(function() {
      dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'foo', 5)
  }, 'TXTRecordSetValue() must throw when called with strange value');
  t.throws(function() {
      dns_sd.TXTRecordSetValue(new dns_sd.TXTRecordRef(), 'illeagal=key', 'bar')
  }, 'TXTRecordSetValue() must throw when called with strange value');

  t.throws(function() { dns_sd.TXTRecordGetLength() },
      'not enough arguments must throw');
  t.throws(function() { dns_sd.TXTRecordGetLength(5) },
      'illegal arguments must throw');
  t.throws(function() { dns_sd.TXTRecordGetLength({not_a_buffer: true}) },
      'illegal arguments must throw');

  t.doesNotThrow(function() { dns_sd.TXTRecordDeallocate( txtRecord ); },
      'deallocating a txtRecord must not throw');
  t.throws(function() { dns_sd.TXTRecordDeallocate(); },
      'TXTRecordDeallocate() must throw when called without arguments');
  t.throws(function() { dns_sd.TXTRecordDeallocate(null, null); },
      'TXTRecordDeallocate() must throw when called with more than one argument');

  t.throws(function() { dns_sd.txtRecordBufferToObject(); },
      'txtRecordBufferToObject() must throw when called with no arguments');

  t.throws(function() { dns_sd.txtRecordBufferToObject(5); },
      'txtRecordBufferToObject() must throw when called with a non-object');

  t.throws(function() { dns_sd.txtRecordBufferToObject({not_a_txt_record_ref: true}); },
      'txtRecordBufferToObject() must throw when called with strange objects');

  t.done();
}

//=== buildException ==========================================================

exports['buildException()'] = function(t) {
  t.strictEqual(dns_sd.buildException(dns_sd.kDNSServiceErr_NoError), undefined,
      'buildException(kDNSServiceErr_NoError) must return undefined');

  var ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Unknown);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Unknwon) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Unknown);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NoSuchName);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NoSuchName) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NoSuchName);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NoMemory);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NoMemory) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NoMemory);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadParam);
  t.ok(ex instanceof Error,
      'buildException() must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadParam);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadReference);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_BadReference) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadReference);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadState);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_BadState) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadState);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadFlags);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_BadFlags) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadFlags);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Unsupported);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Unsupported) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Unsupported);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NotInitialized);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NotInitialized) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NotInitialized);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_AlreadyRegistered);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_AlreadyRegistered) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_AlreadyRegistered);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NameConflict);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NameConflict) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NameConflict);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Invalid);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Invalid) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Invalid);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Firewall);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Firewall) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Firewall);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Incompatible);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Incompatible) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Incompatible);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadInterfaceIndex);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_BadInterfaceIndex) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadInterfaceIndex);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_Refused);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_Refused) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_Refused);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NoSuchRecord);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NoSuchRecord) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NoSuchRecord);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NoAuth);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NoAuth) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NoAuth);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NoSuchKey);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NoSuchKey) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NoSuchKey);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_NATTraversal);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_NATTraversal) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_NATTraversal);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_DoubleNAT);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_DoubleNAT) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_DoubleNAT);

  ex = dns_sd.buildException(dns_sd.kDNSServiceErr_BadTime);
  t.ok(ex instanceof Error,
      'buildException(kDNSServiceErr_BadTime) must return an Error object');
  t.strictEqual( ex.errorCode, dns_sd.kDNSServiceErr_BadTime);

  t.throws(function() { dns_sd.buildException() },
    'not enough arguments');
  t.throws(function() { dns_sd.buildException('foobar') },
    'argument must be a string');
  t.done();
}

exports['exportConstants()'] = function(t) {
  var o = {}
  dns_sd.exportConstants(o);
  t.ok(o.kDNSServiceErr_BadParam);

  t.throws(function() { dns_sd.exportConstants() });
  t.throws(function() { dns_sd.exportConstants(5) });

  t.done();
}

// vim: filetype=javascript:
