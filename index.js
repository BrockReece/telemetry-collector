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
    console.log('a user connected: ' + socket.id);
    socket.on('disconnect', function(){
        console.log('user disconnected');
    });

    socket.on('telemetry', (body) => {
        client.index({
            index: 'telemetry',
            type: body.type,
            body: {
                timestamp: new Date().toISOString(),
                session_id: socket.id,
                referer: socket.handshake.headers.referer,
                ...body
            },
        })
    })
});

app.get('/users', function (req, res) {
    const filters = Object.keys(req.query).map((key) => {
        const name = ['user_id'].indexOf(key) === - 1 ? `${key}.raw` : key
        return {
            term: { [name]: req.query[key], },
        }
    })

    client.search({
        index: 'telemetry',
        body: {
            size: 0,
            query: {
                bool: {
                    filter: filters,
                },
            },
            aggs: {
                users: {
                    terms: {
                        field: "user_id.raw",
                    },
                }
            }
        },
    }).then((results) => {
        res.json(results)
    }).catch(err => res.json(err))
})

app.get('/', function (req, res) {
    const filters = Object.keys(req.query).map((key) => {
        const name = ['user_id'].indexOf(key) === - 1 ? `${key}.raw` : key
        return {
            term: { [name]: req.query[key], },
        }
    })

    client.search({
        index: 'telemetry',
        body: {
            size: 0,
            query: {
                bool: {
                    filter: filters,
                },
            },
            aggs: {
                urls: {
                    terms: { field: "name.raw" },
                    aggs: {
                        start: {
                            avg: { field: "startTime" }
                        },
                        duration: {
                            avg: { field: "duration" }
                        },
                        request: {
                            avg: { field: "requestStart" }
                        },
                        end: {
                            avg: { field: "responseEnd" }
                        },
                    },
                }
            }
        },
    }).then((results) => {
        res.json(results)
    }).catch(err => res.json(err))
});

http.listen(process.env.NODE_PORT || 3000, function(){
    console.log('listening on *:' + process.env.NODE_PORT || 3000);
});
