var express = require('express')
	,sio = require('socket.io');

var app = express.createServer();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.listen(3000);
var io = sio.listen(app);

var rooms = {};
app.get('/:id',function(req,res){
	var id = '/'+ req.params.id;
	if(id === '/favicon.ico'){
		res.writeHead(404);
		res.end();
		return;
	}
	
	if(!rooms[id]){
		console.log('new room create %s',id);
		var room = rooms[id] = {};
		room.id = id;
		room.sockets = io.of(id);
		room.counter = 0;
		room.sockets.on('connection',function(socket){
			console.log('connection');
			room.counter++;
			room.sockets.volatile.emit('counter',room.counter);
			
			socket.on('send',function(data){
				if(data.user && data.text){
					data.text = data.text.replace(/\r?\n/g, "<br/>");
					data.date = new Date();
					room.sockets.emit('msg',data);
				}
			});
			
			socket.on('disconnect',function(){
				room.counter--;
				if(room.counter <= 0){
					console.log('delete room %s',room.id);
					room.sockets.removeAllListeners();
					delete rooms[room.id];
				} else {
					room.sockets.volatile.emit('counter',room.counter);
				}
			});
		});
		res.redirect(id);
	} else {
		res.render('index', { id: id ,layout:false});
	}
});
