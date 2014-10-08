var dns_sd    = require('./dns_sd')
  , util      = require('util')
  , events    = require('events')
  , IOWatcher = require('./io_watcher').IOWatcher;
  ;

function MDNSService() {
  events.EventEmitter.call(this);
  var self = this;

  self._watcherStarted = false;
  self.serviceRef = new dns_sd.DNSServiceRef();
  self.watcher = new IOWatcher();
  self.watcher.host = self; // TODO: Find out what this is for ...
  self.watcher.callback = function() {
    if (self._watcherStarted) {
      dns_sd.DNSServiceProcessResult.call(self, self.serviceRef);  
    }
  };
}
util.inherits(MDNSService, events.EventEmitter);
exports.MDNSService = MDNSService;

MDNSService.prototype.start = function start() {
  if (this._watcherStarted) {
    throw new Error("mdns service already started");
  }
  this.watcher.set(this.serviceRef.fd, true, false);
  this.watcher.start();
  this._watcherStarted = true;
}

MDNSService.prototype.stop = function stop() {
  if (this._watcherStarted) {
    this.watcher.stop();
    dns_sd.DNSServiceRefDeallocate(this.serviceRef);
    this.serviceRef = null;
    this._watcherStarted = false;
  }
}
