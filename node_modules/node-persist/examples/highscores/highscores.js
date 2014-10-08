/*
 * This example uses node-persist to store high scores for a game
 * Open up your browser to 'localhost:8080' to see it in action.
 */

 var storage = require('../../../node-persist');
 var express = require('express');
 var fs = require('fs');

storage.initSync();

if(!storage.getItem('scores')){
	storage.setItem('scores',[]);
}
console.log("scores: " + storage.getItem('scores'));

var app = express();

app.configure( function(){
  app.use(express.static(__dirname + '/public'));
  app.use(express.errorHandler());
  app.use(express.bodyParser());
});

// submit a score
app.post("/submit" ,function(req,res){
	var user = req.body.user;
	var score = parseInt(req.body.score,10);

	if(user && score){
		var scores = storage.getItem('scores');
		scores.push({'user':user,'score':score});
		scores.sort(function(a,b){
			return b.score - a.score;
		});
		console.log(scores);
		storage.setItem('scores',scores);
		res.json(scores);
	}else{
		res.send("BAD");
	}
});

// show scores
app.get("/scores" ,function(req,res){
	var scores = storage.getItem('scores');
	res.json(scores);
});

app.listen(8080);
