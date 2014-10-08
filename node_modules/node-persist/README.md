#node-persist
##(localStorage on the server)

###Super-easy (and fast) persistent data structures in Node.js, modeled after HTML5 localStorage
Node-persist doesn't use a database. Instead, JSON documents are stored in the file system for persistence. Because there is no network overhead and your data is just in-memory, node-persist is just about as fast as a database can get. Node-persist uses the HTML5 localStorage API, so it's easy to learn.

This is still a work in progress. Send pull requests please.

##Install
	npm install node-persist

	var storage = require('node-persist');

##Basic Example
	//you must first call storage.init or storage.initSync
	storage.initSync();

	//then start using it
	storage.setItem('name','yourname');
	console.log(storage.getItem('name'));

	var batman = {
		first: 'Bruce',
		last: 'Wayne',
		alias: 'Batman'
	};

	storage.setItem('batman',batman);
	console.log(storage.getItem('batman').alias);

##Run the examples:
	cd examples/examplename
	node examplename.js
	open up localhost:8080

##Options
You can pass init or initSync an options object to customize the behavior of node-persist

	storage.init({
		dir:'relative/path/to/persist',
		stringify: JSON.stringify,
		parse: JSON.parse,
		encoding: 'utf8',
		logging: false,
		continuous: true,
		interval: false
	});

##Documentation
By default, node-persist persists a key directly after persistSync is called on it.

###Node-persist has 3 ways of running:

1. By default, keys will be persisted after every call of setItem
2. If you set an interval, node-persist will persist changed keys at that interval instead of after every call of setItem.
3. If you set continuous to false and don't specify an interval, keys aren't persisted automatically, giving you complete control over when to persist them.

###getItem(key)
This function will get a key from your database, and return its value, or undefined if it is not present.

	storage.getItem('name');
	storage.getItem('obj').key1;
	storage.getItem('arr')[42];


###setItem(key, value)
This function sets 'key' in your database to 'value'. It also sets a flag, notifying that 'key' has been changed and needs to be persisted in the next sweep. Because the flag must be set for the object to be persisted, it is best to use node-persist in a functional way, as shown below.

	storage.setItem('fibonacci',[0,1,1,2,3,5,8]);
	storage.setItem(42,'the answer to life, the universe, and everything.')

	var batman = storage.getItem('batman');
	batman.sidekick = 'Robin';
	storage.setItem('batman',batman); //this ensures the object is persisted

###removeItem(key)
This function removes key in the database if it is present, and immediately deletes it from the file system asynchronously.

	storage.removeItem('me');
	storage.removeItem(42);

###values(callback)
This function returns all of the values in the database.

	storage.setItem("batman", {name: "Bruce Wayne"});
	storage.setItem("superman", {name: "Clark Kent"});
	storage.values(function(vals){
	    console.log(vals); //output: [{name: "Bruce Wayne"},{name: "Clark Kent"}]
	});

###clear()
This function removes all keys in the database, and immediately deletes all keys from the file system asynchronously.

###key(n)
This function returns a key with index n in the database, or null if it is not present. The ordering of keys is not known to the user.

###length()
This function returns the number of keys stored in the database.

##Fine-grained control
Make sure you set continuous: false in the options hash, and you don't set an interval
###persist(), persistSync()
These functions can be used to manually persist the database

		storage.persist();
		storage.persistSync();


###persistKey(key), persistKeySync(key)
These functions manually persist 'key' within the database

		storage.setItem('name','myname');
		storage.persistKey('name');


###[Simon Last](http://simonlast.org)
