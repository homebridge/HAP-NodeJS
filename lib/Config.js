'use strict';

module.exports = {
  useAvahi: useAvahi,
  getAvahiFilepath: getAvahiFilepath,
  shouldNotPersistToDisk: shouldNotPersistToDisk
};

function useAvahi() {
  if (!process.env.AVAHI_TARGET_FILE) {
    return false;
  }
  return process.env.AVAHI_TARGET_FILE.length > 0;
}

function getAvahiFilepath() {
  return process.env.AVAHI_TARGET_FILE;
}

function shouldNotPersistToDisk() {
  return process.env.PERSIST_TO_DISC === 'false';
}
