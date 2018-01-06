var app = require('express')();
var http = require('http').Server(app);
var elasticsearch = require('elasticsearch');
var jwtDecode = require('jwt-decode');
var io = require('socket.io')(http, {
    handlePreflightRequest(req, res) {
        res.writeHead(200, {
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Origin': req.headers.origin || '*' ,
            'Access-Control-Allow-Credentials': true
        });
        res.end();
    }
});

var client = new elasticsearch.Client({
    host: process.env.ELASTIC_HOST || '192.168.99.100:9200',
});

var users = process.env.ALLOWED_USERS || [2117]

// socket authorization middleware
io.use((socket, next) => {
    let token = jwtDecode(socket.handshake.headers['authorization'].replace('Bearer ', ''));

    if (users.indexOf(Number(token.sub)) !== -1) {
        return next();
    }
    return next(new Error('authentication error'));
});

io.on('connection', function(socket){
    console.log('a user connected');
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

    socket.on('telemetry', (body) => {
        client.index({
            index: 'telemetry',
            type: body.type,
            body: {
                timestamp: new Date().toISOString(),
                ...body
            },
        })
    })
});

http.listen(process.env.NODE_PORT || 3000, function(){
    console.log('listening on *:' + process.env.NODE_PORT || 3000);
});
