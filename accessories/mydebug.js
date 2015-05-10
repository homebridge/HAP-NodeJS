/**
 * New node file
 */
// debugging helper only
// inspects an object and prints its properties (also inherited properties) 
var iterate = function nextIteration(myObject, path){
	// this function iterates over all properties of an object and print them to the console
	// when finding objects it goes one level  deeper
	var name;
	for (name in myObject) {
	    if (typeof myObject[name] !== 'function') {
	    	if (typeof myObject[name] !== 'object' ) {
	    		console.log((path  || "") + name + ': ' + myObject[name]);
	    	} else {
	        	nextIteration(myObject[name], path ? path + name + "." : name + ".");
	        }
	    }
	}
};
module.exports.iterate = iterate; 