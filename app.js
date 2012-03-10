var express = require('express')
	,sio = require('socket.io')
	,redis = require('redis')
	,client = redis.createClient()

var app = express.createServer();


app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
	app.use(express.errorHandler()); 
});

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.listen(process.argv[2] || 80);
var io = sio.listen(app);

io.configure('production', function(){
	io.enable('browser client etag');
	io.enable('browser client gzip');
	io.enable('browser client minification');
	io.set('log level', 1);

	io.set('transports', [
	'websocket'
	, 'xhr-polling'
	, 'jsonp-polling'
	]);
});
io.configure('development', function(){
	io.set('log level', 3);
	io.set('transports', [
	'websocket'
	]);
});

//data delete
app.get('/:id/del',function(req, res){
	var id = '/' + req.params.id;
	client.del(id);
	res.redirect(id);
});


//room
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
			room.counter++;
			room.sockets.emit('counter',room.counter);
				
			client.zrange(room.id, -50,-1, function(err, list){
				console.log(list);
				socket.emit('msg',list);
			});

			socket.on('send',function(data){
				if(data.user && data.text){
					data.date = new Date();
					client.zadd(room.id, data.date.getTime() ,JSON.stringify(data));
					room.sockets.emit('msg',[JSON.stringify(data)]);
				}
			});
			
			socket.on('disconnect',function(){
				room.counter--;
				if(room.counter <= 0){
					console.log('counter zero: %s',room.id);
					delete rooms[room.id];
				} else {
					room.sockets.emit('counter',room.counter);
				}
			});
		});
		res.redirect(id);
	} else {
		res.render('index', { id: id ,layout:false});
	}
});
