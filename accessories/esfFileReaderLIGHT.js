/**
 *  esfFileReader module
 *  provides parseFile(fileName, filter) function to parse ETS4 ESF export files
 *  The filter can be used to restrict parsing to lines beginning with literal filter. 
 *  Example:
 *  If your KNX group structure has the service type in the first level (such as Lightning), the OPC export file will look like Lightning.FirstFloor.1/0/0 Aisle Lightning EIS 1 'Switching' (1 Bit)	Low	1/0/100 1/4/0
 *  In this example, "lightning" would be the filter to pass.
 *  
 *  For KNX standards or manufacturers, please refer to http://www.knx.org
 */

var fs = require('fs');
//helper = require('./mydebug.js');


var gaTypes = {
		BrightnessControl : 1,
		ReturnValue : 2
};

/*
 * gaStructureLightArray ({text:ETS4_esf_file_contents, [optional] filter:Mandatory Line Start String)
 * returns Array of KNX Lights with on/off and Set Brightness features
 */
var gaStructureLightArray = function (params) {
	
	if (!params) {
		throw {name: "NOPARAMS", message: "gaStructureArray requires an parameter object {text: String, filter: Optional String}"};
	}
	var text = params.text || "";
	var filter = params.filter;
	
	var lights = []; // hier go the lights themselves
	var lights_specials = []; // here park all addresses that are brightness controls, or return value addresses
	
	// lines should look like
	// Lightning.Untergeschoss.1/0/0	Aisle Lightning	EIS 1 'Switching' (1 Bit)	Low	1/0/100 1/4/0
	// Area1.Area2.groupAdress TAB Name TAB EIS SPC EIS-Usage SPC Size TAB Prio TAB Listening Addresses (SPC seperated) CR LF 
	
	// get a single line from text that matches the filter definition
	// http://stackoverflow.com/questions/5090103/javascript-regexp-dynamic-generation-from-variables
	//
	var lineP = /(.*?)(?:\r\n)/gi; //default: do match any line
	if (filter) {
		// filter supplied: match only lines that start with filter expression
		lineP = new RegExp("((?:" + filter + ")(?:.*?))(?:\r\n)","gi");
	}
	// break in groups
	var paramsP = /([^\t]+)(?:\t)([^\t]+)(?:\t)([^\t]+)(?:\t)([^\t]+)(?:\t)([^\t]*)/gi; // last group (additional listening addresses) is optional
	
	var regmatch, parmatch;

	while ((regmatch = lineP.exec(text))) { //not a good part: assignment and test for undefined at once
		// so get the line
		// break in groups
		while ((parmatch = paramsP.exec(regmatch[1]))) {
			//console.log(parmatch); //debug
			// now get the parameters
			/*
			 *0 [ 'Lightning.FirstFloor.1/0/0\tAisle Lightning\tEIS 1 'Switching' (1 Bit)\tLow\t1/0/100 1/4/0',
			  1 'Lightning.FirstFloor.1/0/0',
			  2 'Aisle Lightning',
			  3 'EIS 1 'Switching' (1 Bit)',
			  4 'Low',
			  5 '1/0/100 1/4/0',

			 */
			var light = new Object();
			light.groupAdress = parmatch[1].match(/([\d]+\/[\d]+\/[\d]+)/)[1]; // 1/0/0
			light.fullname = parmatch[1].match(/(?:[^.]*\.)([^.]*)/)[1]; // do not include the first group and the dot: "FirstFloor" // dots are not liked by mDNS as names
			light.fullname += " " + parmatch[2]; // add "Aisle Lightning"
			light.eisType = parmatch[3]; // EIS 1 'Switching' (1 Bit)
			if (parmatch[5].length>0) {  // 1/0/100 1/4/0
				light.listenAdresses = parmatch[5].split(" ");
				light.listenAdresses.push(light.groupAdress); //always listen to yourself!
			} else {
				light.listenAdresses = [light.groupAdress];
			}
			
			//console.log("listenAdresses=" + listenAdresses); //debug
			if (light.fullname.match(/([\d]+\/[\d]+\/[\d]+)/) !== null ) { 
				//contains an address in the name!
				// its a specials address and no device in Siri's sense!
				light.referredAddress = light.fullname.match(/([\d]+\/[\d]+\/[\d]+)/)[1];
				//console.log("referredAddress=" + referredAddress); //debug
				// supported types 
				// 1/2/3  it's a return value group address for 1/2/3
				// 1/2/3B it's a BRIGHTNESS CONTROL for 1/2/3
				if (light.fullname.match(/([\d]+\/[\d]+\/[\d]+)([^\d])/) !== null) {
					//postfix found
					if (light.fullname.match(/([\d]+\/[\d]+\/[\d]+)(B)/) !== null) {
						light.specialType = gaTypes.BrightnessControl;
					} else {
						console.log("OOOOOOOO");
						console.log(light.fullname.match(/([\d]+\/[\d]+\/[\d]+)([^\d])/));
						throw {name: 'unsupportet GA special type', message: 'only B is supported'};
					}
				} else {
					light.specialType = gaTypes.ReturnValue;
				}
				
				//console.log("specialType=" + light.specialType); //debug
				lights_specials.push(light); // park that special type
			} else {
				// now check whether the last character from its name is an X
				if (light.fullname.match(/X$/i)) {
					//ignore it!
					delete light;
				} else {
					// all went well, it's a default switching light's address
					lights.push(light);					
				}

			}
		}		
	}
	
	// here we have to arrays if all went well
	// lights with standard light addresses
	// lights_special with additional features
	
	// for each special feature, we need to look up the standard light an augment it
	
	var feature;
	var temp;
	for (feature in lights_specials) {
		for (temp in lights) {
			if (lights[temp].groupAdress === lights_specials[feature].referredAddress) {
				switch(lights_specials[feature].specialType) {
				case gaTypes.ReturnValue:
					// add address to listen addresses
					lights[temp].listenAdresses.push(lights_specials[feature].groupAdress);
					break;
				case gaTypes.BrightnessControl:
					// its a dimmer object
					lights[temp].brightnessController = lights_specials[feature];
					break;
				}
			}
		}
		// might be return addresses for dimmers themselves...
		for (temp in lights_specials) {
			if (lights_specials[temp].groupAdress === lights_specials[feature].referredAddress) {
				switch(lights_specials[feature].specialType) {
				case gaTypes.ReturnValue:
					// add address to listen addresses
					lights_specials[temp].listenAdresses.push(lights_specials[feature].groupAdress);
					break;
				case gaTypes.BrightnessControl: // dimmers should have no dimmers themselves
					// its a dimmer object
					throw {name: "ESTRUCTEFAILURE", message: "Dimmer object assigned to dimmer object"};
					break;
				}
			}
		}
	}
	
	// http://stackoverflow.com/questions/9229645/remove-duplicates-from-javascript-array
	function uniq(a) {
	    var seen = {};
	    return a.filter(function(item) {
	        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
	    });
	}
	
	var lightId;
	for (lightId in lights) {
		lights[lightId].listenAdresses = uniq(lights[lightId].listenAdresses);
		if (lights[lightId].hasOwnProperty("brightnessController")) {
			lights[lightId].brightnessController.listenAdresses = uniq(lights[lightId].brightnessController.listenAdresses);
			//console.log("Check: "+ lights[lightId].BrightnessController.listenAdresses);
		} 
	}
	
	return lights;
}; 


var parseFile = function (filename, filter) {
	var text = fs.readFileSync(filename,'utf-8');
	return gaStructureLightArray({text: text, filter: filter});
};


module.exports.parseFile = parseFile;


