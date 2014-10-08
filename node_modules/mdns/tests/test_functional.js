#!/usr/bin/env node

var mdns_test = require('../utils/lib/mdns_test')
  , mdns      = mdns_test.require('mdns')
  , nif       = require('../lib/network_interface.js')
  , os        = require('os')
  ;

exports['simple browsing'] = function(t) {
  var timeout = 5000
    , port = 4321
    , service_type = mdns_test.suffixedServiceType('node-mdns', 'tcp');
    ;

  var timeoutId = setTimeout(function() {
    t.fail("test did not finish within " + (timeout / 1000) + " seconds.");
    t.done();
  }, timeout)

  var browser = mdns.createBrowser(service_type, {context: {some: 'context'}});

  function stopBrowserIfDone() {
    if (upCount > 0 &&
        downCount > 0 && 
        upCount == downCount && 
        changedCount == upCount + downCount)
    {
      browser.stop();
      clearTimeout(timeoutId);
      t.done();
    }
  }

  var changedCount = 0;
  browser.on('serviceChanged', function(service, ctx) {
    //console.log("changed:", service);
    t.strictEqual(typeof service.flags, 'number',
        "'flags' must be a number");
    if (changedCount === 0) {
      t.ok(service.flags & mdns.kDNSServiceFlagsAdd,
          "'flags' must have kDNSServiceFlagsAdd set");
      t.strictEqual(typeof service.fullname, 'string',
          "'fullname' must be a string");
      t.strictEqual(typeof service.host, 'string',
          "'host' must be a string");
      t.strictEqual(typeof service.port, 'number',
          "'port' must be a number");
      t.strictEqual(service.port, port,
          "'port' must match the advertisement");

      t.ok('addresses' in service, 
          "'service' must have a address property");
      t.ok(Array.isArray(service.addresses),
          "'addresses' must be an array");
      t.ok(service.addresses.length > 0,
          "addresses must not be empty");
    }
    t.strictEqual(typeof service.interfaceIndex, 'number',
        "'interfaceIndex' must be a number");
    t.strictEqual(typeof service.name, 'string',
        "'name' must be a string");
    t.ok(service.type instanceof mdns.ServiceType,
        "'type' must be a service type object");
    t.strictEqual('' + service.type, service_type + '.',
        "type must match the target type");
    t.strictEqual(typeof service.replyDomain, 'string',
        "'replyDomain' must be a string");
    t.strictEqual(service.replyDomain, 'local.',
        "'replyDomain' must match 'local.'");

    t.strictEqual(typeof service.networkInterface, 'string',
        'must have a networkInterface');

    t.ok(ctx, 'must have context');
    t.strictEqual(ctx.some, 'context', 'property must match input');

    changedCount += 1;
    stopBrowserIfDone();
  });

  var upCount = 0;
  browser.on('serviceUp', function(service, ctx) {
    //console.log("up:", service);
    t.strictEqual(typeof service.flags, 'number',
        "'flags' must be a number");
    t.strictEqual(typeof service.interfaceIndex, 'number',
        "'interfaceIndex' must be a number");
    t.strictEqual(typeof service.name, 'string',
        "'name' must be a string");
    t.ok(service.type instanceof mdns.ServiceType,
        "'type' must be ServiceType object");
    t.strictEqual('' + service.type, service_type + '.',
        "'type' must match target type");
    t.strictEqual(typeof service.replyDomain, 'string',
        "'replyDomain' must be a string");
    t.strictEqual(service.replyDomain, 'local.',
        "'replyDomain' must match 'local.'");

    t.strictEqual(typeof service.fullname, 'string',
        "'fullname' must be a string");
    t.strictEqual(typeof service.host, 'string',
        "'host' must be a string");
    t.strictEqual(typeof service.port, 'number',
        "'port' must be a number");
    t.strictEqual(service.port, port,
        "'port' must match");

    t.ok('addresses' in service,
        "'service' must have a addresses property");
    t.ok(Array.isArray(service.addresses),
        "'addresses' must be a string");
    t.ok(service.addresses.length > 0,
        "'addresses' must not be empty");

    t.ok('rawTxtRecord' in service,
        "'service' must have a rawTxtRecord property");
    t.ok(service.rawTxtRecord,
        "'rawTxtRecord' must be truthy");
    t.ok(service.txtRecord,
        "'txtRecord' must be truthy");

    t.strictEqual(typeof service.networkInterface, 'string',
        'must have a networkInterface');

    var p;
    for (p in txt_record) {
      t.strictEqual('' + txt_record[p], service.txtRecord[p],
          "property " + p + " in txtRecord must match");
    }
    
    t.ok(ctx, 'must have context');
    t.strictEqual(ctx.some, 'context', 'property must match input');

    upCount += 1;
    stopBrowserIfDone();
  });

  var downCount = 0;
  browser.on('serviceDown', function(service, ctx) {
    t.strictEqual(typeof service.flags, 'number',
        "'flags' must be a number");
    t.strictEqual(typeof service.interfaceIndex, 'number',
        "'interfaceIndex' must be a number");
    t.strictEqual(typeof service.name, 'string',
        "'name' must be a string");
    t.ok(service.type instanceof mdns.ServiceType,
        "'type' must be a ServiceType object");
    t.strictEqual('' + service.type, service_type + '.',
        "'type' must match target aervice type");
    t.strictEqual(typeof service.replyDomain, 'string',
        "'replyDomain' must be a string");
    t.strictEqual(service.replyDomain, 'local.',
        "'replyDomain' must match 'local.'");

    t.strictEqual(typeof service.networkInterface, 'string',
        'must have a networkInterface');

    t.ok(ctx, 'must have context');
    t.strictEqual(ctx.some, 'context', 'property must match input');

    downCount += 1;
    stopBrowserIfDone();
  });

  browser.start();

  var txt_record = {type: 'bacon', chunky: true, strips: 5, buffer: new Buffer('raw')}
    , ad = mdns.createAdvertisement(service_type, port,
        {txtRecord: txt_record}, function(err, service, flags) {
          if (err) throw err;
          setTimeout(function() { ad.stop() }, 500);
        });

  ad.start();
}

exports['create ads'] = function(t) {
  var timeout = 500 // ms
    , counter = 0
    ;

  function stopIfDone() {
    if (++counter === 4) {
      t.done();
    }
  }
  var ad1 = mdns.createAdvertisement(['mdns-test1', 'tcp'], 4321);
  ad1.start();
  setTimeout(function() { ad1.stop(); stopIfDone(); }, timeout);

  var ad2 = mdns.createAdvertisement(['mdns-test2', 'tcp'], 4322, {});
  ad2.start();
  setTimeout(function() { ad2.stop(); stopIfDone(); }, timeout);

  function checkAd(service, name, proto) {
    t.ok('flags' in service,
        "service must have a flags property");
    t.strictEqual(typeof service.flags, 'number',
        "'flags' must be a number");
    t.ok(service.type instanceof mdns.ServiceType,
        "'type' must be a ServiceType object");
    t.strictEqual(service.type.toString(), '_' + name + '._' + proto + '.',
        "'type' must be as advertised");
  }

  var ad3 = mdns.createAdvertisement(['mdns-test3', 'tcp'], 4323, {name: 'foobar'}, function(error, service) {
    if (error) t.fail(error);
    
    checkAd(service, 'mdns-test3', 'tcp');

    var ad = this;
    setTimeout(function(){ ad.stop(); stopIfDone(); }, timeout);
  });
  ad3.start();

  var ad4 = mdns.createAdvertisement(['mdns-test4', 'udp'], 4324, {}, function(error, service) {
    if (error) t.fail(error);

    checkAd(service, 'mdns-test4', 'udp');

    var ad = this;
    setTimeout(function(){ ad.stop(); stopIfDone(); }, timeout);
  });
  ad4.start();

}

exports['browseThemAll()'] = function(t) {
  var browser = new mdns.browseThemAll()
    , up = 0
    , down = 0
    , changed = 0
    , type = mdns_test.suffixedServiceType('node-mdns', 'udp')
    ;

  // XXX
  console.log('[SKIPPED] write better test for browseThemAll()');
  t.done();
  return; // XXX

  browser.on('serviceUp', function(service) {
    if (type.matches(service.type)) {
      ++up;
    }
  });
  browser.on('serviceDown', function(service) {
    if (type.matches(service.type)) {
      ++down;
    }
  });
  browser.on('serviceChanged', function(service) {
    if (type.matches(service.type)) {
      ++changed;
    }
  });

  // it takes forever until the service type disappears
  var cooltime = 15000;
  var timeoutId = setTimeout(cooltime + 5000, function() {
    t.ok(false, "test did not finish");
    t.done();
  });
  var ad = mdns_test.runTestAd(type, 1337, 2000, cooltime, function() {
    //t.strictEqual(down, up, 'up count must match down count');
    //t.strictEqual(down + up, changed, 'up plus down must equal changed count');
    console.log('[SKIPPED] write better test for browseThemAll()')
    browser.stop();
    clearTimeout(timeoutId);
    t.done();
  });

  browser.start();
}

exports['resolver sequence'] = function(t) {
  var type = mdns_test.suffixedServiceType('node-mdns', 'tcp')
    , browser = new mdns.createBrowser(type, {resolverSequence: []})
    , rst = mdns.rst
    ;

  browser.on('serviceUp', function(service) {
    t.ok( ! ('host' in service),
        "service must not have a 'host' property");
    t.ok( ! ('port' in service),
        "service must not have a 'port' property");
    t.ok( ! ('fullname' in service),
        "service must not have a 'fullname' property");
    t.ok( ! ('addresses' in service),
        "service must not have an 'addresses' property");

    var result_count = 0;
    function done() {
      if (++result_count === 3) {
        t.done();
      }
    }
    var s1 = clone(service);
    mdns.resolve(s1, function(error, service) {
      //console.log('default resolve:', error, service);
      if (error) throw error;
      t.ok('host' in service,
        "service must have a 'host' property");
      t.ok('port' in service,
        "service must have a 'port' property");
      t.ok('fullname' in service,
        "service must have a 'fullname' property");
      t.ok('addresses' in service,
        "service must have an 'addresses' property");
      done();
    });

    var s2 = clone(service);
    var seq2 = [rst.DNSServiceResolve(), rst.getaddrinfo()];
    mdns.resolve(s2, seq2, function(error, service) {
      //console.log('getaddrinfo resolve:', error, service);
      if (error) throw error;
      t.ok('host' in service,
        "service must have a 'host' property");
      t.ok('port' in service,
        "service must have a 'port' property");
      t.ok('fullname' in service,
        "service must have a 'fullname' property");
      t.ok('addresses' in service,
        "service must have an 'addresses' property");
      done();
    });

    var s3 = clone(service);
    var seq3 = [rst.DNSServiceResolve()];
    mdns.resolve(s3, seq3, function(error, service) {
      //console.log('resolve (no addresses):', error, service);
      if (error) throw error;
      t.ok('host' in service,
        "service must have a 'host' property");
      t.ok('port' in service,
        "service must have a 'port' property");
      t.ok('fullname' in service,
        "service must have a 'fullname' property");
      t.ok( ! ('addresses' in service),
        "service must not have an 'addresses' property");
      done();
    });

    browser.stop();
  });

  var ad = mdns_test.runTestAd(type, 1337, 1000, function() {});

  browser.start();

  function clone(o) {
    var clone = {}, p;
    for (p in o) {
      clone[p] = o[p];
    }
    return clone;
  }
}

exports['local advertisement invisible on external interfaces'] = function(t) {
  var st = mdns.tcp('local-ad')
    , exif = someExternalInterface()
    , avahi = require('../lib/avahi')
    ;
  if (avahi) {
    console.log('[SKIPPED] avahi does not support local only operation');
    t.done();
    return;
  }
  if ( ! exif) {
    console.log('[SKIPPED] failed to find an external network interface');
    t.done();
    return;
  }
  var ad = mdns.createAdvertisement(st, 4321, 
      {networkInterface: mdns.loopbackInterface()})
    , externalBrowser = mdns.createBrowser(st, {networkInterface: exif})
    , externalBrowserEvents = 0
    ;
  externalBrowser.on('serviceUp', function(service) {
    externalBrowserEvents++;
  });
  externalBrowser.on('serviceDown', function(service) {
    externalBrowserEvents++;
  });
  var loopbackBrowser = mdns.createBrowser(st,
      {networkInterface: mdns.loopbackInterface()});
  loopbackBrowser.on('serviceUp', function(service) {
    t.strictEqual(service.interfaceIndex, mdns.loopbackInterface(),
        'service must have the loopback interface index');
    t.strictEqual(service.networkInterface, nif.loopbackName(),
        'service must have the loopback interface name');
    setTimeout(function() { ad.stop() }, 1000);
  });
  loopbackBrowser.on('serviceDown', function(service) {
    t.strictEqual(service.interfaceIndex, mdns.loopbackInterface(),
        'service must have the loopback interface index');
    t.strictEqual(service.networkInterface, nif.loopbackName(),
        'service must have the loopback interface name');
    setTimeout(function() {
      t.strictEqual(externalBrowserEvents, 0, 
        'browser on external interface must not receive events');
      externalBrowser.stop();
      loopbackBrowser.stop();
      t.done();
    }, 1000);
  });
  externalBrowser.start();
  loopbackBrowser.start();
  ad.start();
}

function someExternalInterface() {
  var ifaces = os.networkInterfaces()
    , loopback = nif.loopbackName()
    ;
  for (var name in ifaces) {
    if (name !== loopback) {
      return name;
    }
  }
  throw new Error('failed to find an external network interface');
}

// vim: filetype=javascript :
