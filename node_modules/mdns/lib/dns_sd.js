var path = require('path');
var major, minor, patch;

if (process.version.match(/^v(\d+)\.(\d+)\.(\d+).*$/)) {
  major = parseInt(RegExp.$1);
  minor = parseInt(RegExp.$2);
  patch = parseInt(RegExp.$3);
}

var default_dir = major === 0 && minor <= 4 ? 'default' : 'Release'
  , buildtype = process.env.BUILDTYPE || default_dir
  ;

//console.log(major, minor, patch, default_dir, buildtype);

function product(type) { 
  if (type === 'Coverage') {
    return path.join('..', 'dns_sd_bindings') 
  }
  return path.join('..', 'build', type, 'dns_sd_bindings') 
}

try {
  module.exports = require(product(buildtype));
} catch (ex) {
  if (! ex.code) {
    if (/not find/.test(ex)) {
      ex.code = 'MODULE_NOT_FOUND';
    }
  }
  if (ex.code === 'MODULE_NOT_FOUND') {
    module.exports = require(product(default_dir));
    console.warn('dns_sd: failed to load requested ', buildtype, 'build. using', default_dir, 'instead.');
  } else {
    throw ex;
  }
}
