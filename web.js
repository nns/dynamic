var express = require('express')
    ,sio = require('socket.io')
    //  ,redis = require('redis')
    //  ,client = redis.createClient()
    ,parseCookie = require('connect').utils.parseCookie
    ,crypto = require('crypto')

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
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'secrets' ,cookie:{maxAge: 94670777 * 1000}}));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

//app.listen(process.argv[2] || 80);
//
app.listen(process.env.PORT);
var io = sio.listen(app);

io.configure('production', function(){
  io.enable('browser client etag');
  io.enable('browser client gzip');
  io.enable('browser client minification');
  io.set('log level', 1);

  io.set('transports', [
    'xhr-polling'
    , 'jsonp-polling'
  ]);
});
io.configure('development', function(){
  io.set('log level', 1);
  io.set('transports', [
    'xhr-polling'
  ]);
});

var ids = {};
io.configure(function () {
  io.set('authorization', function (handshakeData, callback) {
    if(handshakeData.headers.cookie) {
      var cookie = handshakeData.headers.cookie;
      var sessionID = parseCookie(cookie)['connect.sid'];
      var id = ids[sessionID];
      handshakeData.expressSessionID = sessionID;
      if(id){
        handshakeData.sessionID = id;
      } else {
        handshakeData.sessionID = ids[sessionID] = crypto.randomBytes(12).toString('base64');
      }

    }
    callback(null, true);
  });
});



var comments = {};
//data delete
app.get('/:id/del',function(req, res){
  var id = '/' + req.params.id;
  //client.del(id);
  delete comments[id];
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
    comments[id] = [];

    room.sockets.on('connection',function(socket){
      room.counter++;
      room.sockets.emit('counter',room.counter);

      //client.zrange(room.id, -50,-1, function(err, list){
        //  socket.emit('msg',list);
        //});
        socket.emit('msg', comments[room.id]);

        socket.on('send',function(data){
          if(data.user && data.text){
            data.date = new Date();
            data.sessionID = socket.handshake.sessionID;
            //client.zadd(room.id, data.date.getTime() ,JSON.stringify(data));
            comments[room.id].push(JSON.stringify(data));
            room.sockets.emit('msg',[JSON.stringify(data)]);
            if(comments[room.id].length >= 50 ){
              console.log('shift:%s', room.id);
              comments[room.id].shift();
            }
          }
        });

        socket.on('disconnect',function(){
          room.counter--;
          delete ids[socket.handshake.sessionID];
          if(room.counter <= 0){
            console.log('counter zero: %s',room.id);
            room.sockets.removeAllListeners();
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