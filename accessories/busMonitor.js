var knxd = require("eibd");
var knxdOpts = require("./knxdOpts.js");

/* 
 * 
 * The busMonitor module listens on the KNX bus for telegrams.
 * accessories can register their addresses to get notified of changes

Usage:
	on initializing characteristics, they register with their onRegister calls with the busMonitor.registerGA

AUTHOR snowdd1 on GITHUB	

*/
var subscriptions = []; //to check: is that an private array? // it is in a nodeJS module!
var running; 

function groupsocketlisten(opts, callback) {
	var conn = knxd.Connection();
	conn.socketRemote(opts, function() {
		conn.openGroupSocket(0, callback);
	});
}


function registerSingleGA (mycharacteristics, groupAddress) {
	subscriptions.push({char: mycharacteristics, address: groupAddress });
}
		 
function updateValueOfChar(char, value) {
	char.updateValue(value, null); // we are no peer (used if accessory is EventEnabled)
}


/*
 * public busMonitor.startMonitor()
 * starts listening for telegrams on KNX bus
 * 
 */ 
var startMonitor = function startMonitor() {
	if (!running) {
		running = true;
	} else {
		return null;
	}
		
    groupsocketlisten({ host: knxdOpts.knxdServer, port: knxdOpts.knxdServerPort }, function(parser) {
    	//console.log("knxfunctions.read: in callback parser");
        parser.on('write', function(src, dest, type, val){
            // search the registered group addresses
            for (var i = 0; i < subscriptions.length; i++) {
            	// iterate through all registered addresses
            	if (subscriptions[i].address === dest) {
            		// found one, notify
                    console.log('HIT: Write from '+src+' to '+dest+': '+val+' ['+type+']');
            		updateValueOfChar(subscriptions[i].char, val);
            	}
            }
          });

          parser.on('response', function(src, dest, type, val) {
            // search the registered group addresses
            for (var i = 0; i < subscriptions.length; i++) {
            	// iterate through all registered addresses
            	if (subscriptions[i].address === dest) {
            		// found one, notify
                    console.log('HIT: Response from '+src+' to '+dest+': '+val+' ['+type+']');
                    updateValueOfChar(subscriptions[i].char, val);
            	}
            }
            
          });
          
          //dont care about reads here
//	              parser.on('read', function(src, dest) {
//	                console.log('Read from '+src+' to '+dest);
//	              });
		console.log("knxfunctions.read: in callback parser at end");
    }); // groupsocketlisten parser
}; //startmonitor


/*
 *  public registerGA(mycharacteristics, groupAdresses[])
 *  parameters
 *  	mycharacteristics: characteristics
 *  	groupAddresses: (Array of) string(s) for group addresses
 *  to be called from characteristics constructor as registerGA(this, ["X/Y/Z", "A/B/C"]) or registerGA(this,"X/Y/C")
 *  
 *  
 */
var registerGA = function (mycharacteristics, groupAddresses) {
	// check if the groupAddresses is an array
	if (groupAddresses.constructor.toString().indexOf("Array") > -1) {
		// handle multiple addresses
		for (var i = 0; i < groupAddresses.length; i++) {
			registerSingleGA (mycharacteristics, groupAddresses[i]);
		}
	} else {
		// it's only one
		registerSingleGA (mycharacteristics, groupAddresses);
	}
};
startMonitor();
module.exports.registerGA = registerGA;
//module.exports.startMonitor = startMonitor;
//console.log(module.exports.toString);

