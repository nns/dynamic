
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , sio = require('socket.io')
  , redis = require('redis')
  , client = redis.createClient()
  , crypto = require('crypto')
;

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

app.get('/:room?', routes.index);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var io = sio.listen(server);


io.configure('production', function(){
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.enable('browser client minification');
  io.set('log level', 1);
  io.set('close timeout',10);
  io.set('polling duaration',10);
});
io.configure(function(){
  io.set('transports', [
    'websocket',
    'xhr-polling'
  ]);
});


io.sockets.on('connection', function(socket){
  var userData = socket.userData = {};

  userData.sessinID = crypto.randomBytes(12).toString('base64');

  console.log('connect');
  socket.on('enter room', function(url){
    
    var room = url.split('/').pop();
    room = room || '';
    userData.room = room
    socket.join(room);
    //socket.to(room).emit('message', {message:'enter room:'+ room});

    socket.to(room).emit('counter',io.sockets.clients(room).length);

    client.zrange(room, -50,-1, function(err, list){
      socket.to(room).emit('message',list);
    });
  });

  socket.on('send',function(data){
    console.log(data);
    if(data.user && data.text){
      data.date = new Date();
      data.sessionID = userData.sessinID;
      client.zadd(userData.room, data.date.getTime() ,JSON.stringify(data));
      socket.to(userData.room).emit('message',[JSON.stringify(data)]);
      //socket.to(userData.room).emit('message',[JSON.stringify(data)]);
    }
  });
});





