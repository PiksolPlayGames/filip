const express = require("express");
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3001;
const SocketIOFile = require('socket.io-file');
const path = require('path');

app.use(express.static(__dirname + '/public'));

var sync = {};
var perm;
var users = [];
var rooms = [];
var room;
var loggedIn = false;

io.on('connection', function(socket) {
    var addedUser = false;

    var uploader = new SocketIOFile(socket, {
        uploadDir: './public/image',
        accepts: ['image/jpeg', 'image/jpg', 'image/png'],
        overwrite: true,
        rename: function (filename) {
            var file = path.parse(filename);
            var ext = file.ext;
        return `${socket.roomId}${ext}`;
        }
    });

    uploader.on('start', (fileInfo) => {
        console.log('Start uploading');
    });

    uploader.on('stream', (fileInfo) => {
        console.log(`${fileInfo.wrote} / ${fileInfo.size} byte(s)`);
    });

    uploader.on('complete', (fileInfo) => {
        rooms[socket.roomId][0].background = fileInfo.name;

        console.log(rooms[socket.roomId][0].background);

        io.in(socket.roomId).emit('background', fileInfo.name);
    });


    socket.on('drawing', function(data) {
        if (loggedIn) {
            sync[socket.roomId].push(data);
            socket.broadcast.to(socket.roomId).emit('drawing', sync[socket.roomId]);
        }
    });

    socket.on('add user', function(data) {
        if (addedUser) return;

        socket.username = data.username;
        socket.roomId = data.roomId;
        socket.password = data.password;

        if (!rooms[socket.roomId]) {
            loggedIn = true;
            socket.emit('correct password');
        } else {
            if (rooms[socket.roomId][0].password === data.password) {
                loggedIn = true;
                socket.emit('correct password');
            } else {
                loggedIn = false;
                socket.emit('wrong password');
            }
        }

        if (loggedIn) {

            if (!users[socket.id]) {
                Object.defineProperty(users, socket.id, {
                    value: [],
                    writable: true,
                    enumarable: true,
                    configurable: true
                });
            }

            if (!rooms[socket.roomId]) {
                Object.defineProperty(rooms, socket.roomId, {
                    value: [],
                    writable: true,
                    enumerable: true,
                    configurable: true
                });

                perm = 1;

                room = {
                    admin: socket.id,
                    password: socket.password,
                    users: [
                        [socket.id, data.username, 1]
                    ],
                    background: null,
                    numUsers: 1
                };

                rooms[socket.roomId].push(room);
            } else {
                perm = 0;

                rooms[socket.roomId][0].users.push([socket.id, data.username, 0]);
                rooms[socket.roomId][0].numUsers++;
            }

            if (!sync[data.roomId]) {
                Object.defineProperty(sync, data.roomId, {
                    value: [],
                    writable: true,
                    enumarable: true,
                    configurable: true
                });
            }

            socket.join(socket.roomId);
            addedUser = true;

            socket.emit('sync with server', rooms[socket.roomId]);

            io.in(socket.roomId).emit('user joined', {
                username: socket.username,
                permission: perm
            });
        }
    });

    socket.on('set password', function(data) {
        if (socket.id == rooms[socket.roomId][0].admin) {
            rooms[socket.roomId][0].password = data.password;
        }

        console.log(rooms[socket.roomId][0]);
    });

    socket.on('disconnect', function() {
        if (addedUser) {

            for (var i = 0; i < rooms[socket.roomId][0].users.length; i++) {
                if (rooms[socket.roomId][0].users[i][0] === socket.id) {
                    rooms[socket.roomId][0].users.splice(i, 1);
                }
            }

            socket.leave(socket.roomId);

            rooms[socket.roomId][0].numUsers--;

            io.in(socket.roomId).emit('user left', {
                username: socket.username
            });
        }
    });
});

http.listen(port, () => console.log('listening on port ' + port));