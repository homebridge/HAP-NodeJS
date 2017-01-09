'use strict';

module.exports = {
  useAvahi: useAvahi,
  getAvahiFilepath: getAvahiFilepath
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
