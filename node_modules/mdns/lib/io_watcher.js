var dns_sd = require('./dns_sd');
exports.IOWatcher = typeof dns_sd.SocketWatcher !== 'undefined' ?
    dns_sd.SocketWatcher : process.binding('io_watcher').IOWatcher;
