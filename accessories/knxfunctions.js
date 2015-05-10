var knxd = require("eibd");
var knxdOpts = require("./knxdOpts.js");
//Simple function to send a value (Application Program Data Unit = APDU) to a knx group address
//to do: replace by newer method to send DPT bound values



function groupsocketlisten(opts, callback) {
	// recycled template 
	var conn = knxd.Connection();
	conn.socketRemote(opts, function() {
		conn.openGroupSocket(0, callback);
	});
}


var write= function write(groupAddress, dpt, value) {
	var knxdConnection = new knxd.Connection();
	knxdConnection.socketRemote({ host: knxdOpts.knxdServer, port: knxdOpts.knxdServerPort }, function() {
		var dest = knxd.str2addr(groupAddress);
		knxdConnection.openTGroup(dest, 1, function(err) {
			if (err) {
				console.error("[ERROR] openTGroup:" + err);
			} else {
				var msg = knxd.createMessage('write', dpt, parseFloat(value));
				knxdConnection.sendAPDU(msg, function(err) {
					if (err) {
						console.error("[ERROR] sendAPDU: " + err);
					}
				});
			}
		});
	});
};


module.exports.write = write;