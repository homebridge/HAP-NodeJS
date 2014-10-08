
var vows = require("vows"),
    assert = require("assert"),
    HKDF = require("../lib/hkdf");

var suite = vows.describe('all');

suite.addBatch({
  "an hkdf" : {
    topic: function() {
      var self = this;
      var hkdf = new HKDF('sha256', 'salt123', 'initialKeyingMaterial');
      hkdf.derive('info', 42, function(key) {
        // key is a Buffer, that can be serialized however one desires
        self.callback(null, key);
      });
    },
    "derives keys of the right length": function(err, key) {
      assert.equal(key.length, 42);
    }
  },
  "an hkdf with no salt" : {
    topic: function() {
      var self = this;
      var hkdf = new HKDF('sha256', null, 'initialKeyingMaterial');
      hkdf.derive('info', 42, function(key) {
        // key is a Buffer, that can be serialized however one desires
        self.callback(null, key);
      });
    },
    "derives keys of the right length": function(err, key) {
      // expected value generated using:
      // https://github.com/warner/id-keywrapping-demo/blob/master/hkdf.py
      assert.equal(key.toString('hex'), "5ff4745de6729d5a523337170ab6e12f202c81611bb8cb80e4b44675a16371cadd8e62eebc777b08bf83");
    }
  }
});

// test vectors from RFC5869
suite.addBatch({
  "test vector": {
    topic: function() {
      var self = this;

      var ikm = new Buffer("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", 'hex');
      var salt = new Buffer("000102030405060708090a0b0c", 'hex');
      var info = new Buffer("f0f1f2f3f4f5f6f7f8f9", 'hex');

      var hkdf = new HKDF('sha256', salt, ikm);
      hkdf.derive(info, 42, function(key) {
        // key is a Buffer, that can be serialized however one desires
        self.callback(null, key);
      });
    },
    "works": function(err, output) {
      assert.equal(output.toString('hex'), "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865");
    }
  },
  "test another vector": {
    topic: function() {
      var self = this;

      var ikm = new Buffer("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", 'hex');
      var salt = new Buffer(0); // empty
      var info = ''; // empty

      var hkdf = new HKDF('sha256', salt, ikm);
      hkdf.derive(info, 42, function(key) {
        // key is a Buffer, that can be serialized however one desires
        self.callback(null, key);
      });
    },
    "works": function(err, output) {
      assert.equal(output.toString('hex'), "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8");
    }
  }
})

suite.export(module);
