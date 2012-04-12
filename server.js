var proxy = require('http-proxy');
var options = {
  router: {
    '175.41.194.67/dchat': 'localhost:3000',
    'localhost/dchat' : 'localhost:3000'
  }
};
var server = proxy.createServer(options);

server.on('upgrade',function(req, socket, head){
  console.log(arguments);
  console.log('upgrade');
});

server.listen(80);



