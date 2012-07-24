
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
  , connect = require('connect')
;

var app = express();

app.configure(function(){
  app.set('port', process.argv[2] || 3000);
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

app.get('/dchat/:room', routes.index);

app.get('/dchat/:room/del',function(req, res){
  var room = req.params.room || '/';
  console.log(room);
  client.del(room);
  res.redirect('dchat' + '/' + room);
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var io = sio.listen(server);


io.configure('production', function(){
  console.log('production');
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.enable('browser client minification');
  io.set('log level', 1);
  //io.set('close timeout',10);
  io.set('polling duaration',10);
});
io.configure(function(){
  io.set('transports', [
    'websocket',
    'xhr-polling'
  ]);
});


io.sockets.on('connection', function(socket, options){
  var userData = socket.userData = {};

  console.log('connect');
  socket.on('enter room', function(data){
    url = decodeURI(data.url);
    var room = url.split('/').pop();
    room = room || '/';
    userData.room = room

    var sha1 = crypto.createHash('sha1');
    sha1.update(data.ssid);
    userData.sessionID = sha1.digest('base64').replace('=','')
    console.log('1' + socket.userData.sessionID);
    socket.join(room);
    //socket.to(room).emit('message', {message:'enter room:'+ room});

    io.sockets.to(room).emit('counter',io.sockets.clients(room).length);

    client.zrange(room, -50,-1, function(err, list){
      socket.to(room).emit('message',list);
    });
  });

  socket.on('disconnect', function(){
    console.log('disconnect');
    console.log(io.sockets.clients(userData.room).length);
    io.sockets.to(userData.room).emit('counter',io.sockets.clients(userData.room).length - 1);    
  });

  socket.on('send',function(data){
    if(data.user && data.text){
      data.date = new Date();
      data.sessionID = userData.sessionID;
      console.log('2' + data.sessionID);
      client.zadd(userData.room, data.date.getTime() ,JSON.stringify(data));
      io.sockets.to(userData.room).emit('message',[JSON.stringify(data)]);
      //socket.to(userData.room).emit('message',[JSON.stringify(data)]);
    }
  });
});





