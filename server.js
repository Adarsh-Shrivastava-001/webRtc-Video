//requires
const express = require('express');
const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const port = process.env.PORT || 3000;

// express routing
app.use(express.static('public'));

var nodeList = {};

// signaling
io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('create or join', function (room) {
        console.log('create or join to room ', room);
        
        var myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
        var numClients = myRoom.length;

        console.log(room, ' has ', numClients, ' clients', 'adarsh');

        if (numClients == 0) {
            nodeList[room] = [1];
            console.log("first client just joined");
            console.log('nodeList', nodeList);
            socket.join(room);
            socket.emit('created', room);
        } else{
            nodeList[room].push(Math.max(...nodeList[room])+1);
            console.log(nodeList[room].length, ' clients are present');
            console.log(nodeList);
            socket.join(room);
            socket.emit('joined', {'room':room, 'srcid':Math.max(...nodeList[room])});
        } 
    });

    socket.on('ready', function (obj){
        socket.broadcast.to(obj.room).emit('ready', {'room':obj.room, 'srcid':obj.srcid});
    });

    socket.on('candidate', function (obj){
        console.log('candidate bradocasted from server');
        console.log(obj);
        socket.broadcast.to(obj.event.room).emit('candidate', {'event':obj.event, 'srcid':obj.srcid, 'destid':obj.destid});
        console.log('done');
    });

    socket.on('offer', function(event){
        socket.broadcast.to(event.room).emit('offer',{'remote_sdp':event.sdp, 'srcid':event.srcid, 'destid':event.destid});
    });

    socket.on('answer', function(event){
        socket.broadcast.to(event.room).emit('answer',{'sdp':event.sdp, 'srcid':event.srcid, 'destid':event.destid});
    });

});

// listener
http.listen(port || 3000, function () {
    console.log('listening on', port);
});