(function($) {

    'use strict';

    var socket = io();
    var $usernameInput = $('.usernameInput');
    var $roomId = $('.roomId');
    var $roomPassword = $('.roomPassword');
    var $inputMessage = $('.inputMessage');
    var $loginPage = $('.login.page');
    var $chatPage = $('.chat.page');
    var $currentInput = $usernameInput.focus();
    var $newroom = $('.newroom');
    var $join = $('.join');
    var $disconnect = $('.disconnect');
    var $idRoom = $('.idRoom');
    var $users = $('.users');
    var $chgPassword = $('#chgPassword');
    var $newPassword = $('#newPassword');
    var $cnfNewPassword = $('#cnfNewPassword');
    var $numUsers = $('.numUsers');
    var $red = $('.red');
    var $green = $('.green');
    var $blue = $('.blue');
    var red = 0;
    var green = 0;
    var blue = 0;
    var numUsers;
    var username;
    var roomId;
    var password;
    var canvas = document.getElementsByClassName('whiteboard')[0];
    var context = canvas.getContext('2d');
    var uploader = new SocketIOFileClient(socket);
    var form = document.getElementById('form');

    uploader.on('start', function(fileInfo) {
        console.log('Start uploading', fileInfo);
    });
    uploader.on('stream', function(fileInfo) {
        console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
    });
    uploader.on('complete', function(fileInfo) {
        console.log('Upload Complete', fileInfo);
    });
    uploader.on('error', function(err) {
        console.log('Error!', err);
    });
    uploader.on('abort', function(fileInfo) {
        console.log('Aborted: ', fileInfo);
    });

    form.onsubmit = function(ev) {
        ev.preventDefault();

        var fileEl = document.getElementById('file');
        var uploadIds = uploader.upload(fileEl);
    };

    var current = {
        color: 'rgb(0, 0, 0)'
    };

    var drawing = false;
    canvas.addEventListener('mousedown', onMouseDown, false);
    canvas.addEventListener('mouseup', onMouseUp, false);
    canvas.addEventListener('mouseout', onMouseUp, false);
    canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

    socket.on('drawing', onDrawingEvent);

    window.addEventListener('resize', onResize, false);
    onResize();

    function drawLine(x0, y0, x1, y1, color, emit) {
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.stroke();
        context.closePath();

        if (!emit) {
            return;
        }
        var w = canvas.width;
        var h = canvas.height;

        socket.emit('drawing', {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color
        });
    }

    function onMouseDown(e) {
        drawing = true;
        current.x = e.clientX;
        current.y = e.clientY;
    }

    function onMouseUp(e) {
        if (!drawing) {
            return;
        }
        drawing = false;
        drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
    }

    function onMouseMove(e) {
        if (!drawing) {
            return;
        }
        drawLine(current.x, current.y, e.clientX, e.clientY, current.color, true);
        current.x = e.clientX;
        current.y = e.clientY;
    }

    function throttle(callback, delay) {
        var previousCall = new Date().getTime();
        return function() {
            var time = new Date().getTime();

            if ((time - previousCall) >= delay) {
                previousCall = time;
                callback.apply(null, arguments)
            }
        };
    }

    function onDrawingEvent(data) {
        var w = canvas.width;
        var h = canvas.height;
        for (var i = 0; i < data.length; i++) {
            drawLine(data[i].x0 * w, data[i].y0 * h, data[i].x1 * w, data[i].y1 * h, data[i].color);
        }
    }

    function onResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    $disconnect.click(function() {

        socket.emit('disconnect');

        $chatPage.fadeOut();
        $loginPage.show();
        $chatPage.off('click');

        $users.empty();

        context.clearRect(0, 0, canvas.width, canvas.height);
    });


    $newroom.click(function() {
        setUsernameAndRoomId(false);
    });

    $join.click(function() {
        setUsernameAndRoomId(true);
    });

    $newPassword.hide();
    $cnfNewPassword.hide();

    $chgPassword.click(function() {
        $newPassword.toggle();
        $cnfNewPassword.toggle();
    });

    $cnfNewPassword.click(function() {
        setPassword($newPassword.val());
        $newPassword.toggle();
        $cnfNewPassword.toggle();
    });

    $red.change(function () {
        red = $(this).val();

        setColor(red, green, blue);
    });

    $green.change(function () {
        green = $(this).val();

        setColor(red, green, blue);
    });

    $blue.change(function () {
        blue = $(this).val();

        setColor(red, green, blue);
    });

    function setColor(red, green, blue) {
        current.color = 'rgb(' + red + ', ' + green + ', ' + blue + ')';
    }

    function setUsernameAndRoomId(join) {
        username = cleanInput($usernameInput.val().trim());
        password = cleanInput($roomPassword.val().trim());
        if (join) {
            roomId = cleanInput($roomId.val().trim());
        } else {
            roomId = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for (var i = 0; i < 5; i++)
                roomId += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        $idRoom.html("Id pokoju: " + roomId);

        if (username) {
            socket.emit('add user', {
                username: username,
                roomId: roomId,
                password: password
            });
        }
    }

    socket.on('correct password', function () {
        $loginPage.fadeOut();
        $chatPage.show();
        $loginPage.off('click');
        $currentInput = $inputMessage.focus();
    });

    socket.on('wrong password', function () {
        alert('Niepoprawne hasło!')
    });

    function setPassword(password) {
        socket.emit('set password', {
            username: username,
            password: password
        });

        console.log(password);
    }

    function cleanInput(input) {
        return $('<div>').text(input).html();
    }

    socket.on('background', function(name) {
        var bg = new Image();
        bg.src = '/image/' + name;
        context.drawImage(bg, canvas.width / 2 - bg.width / 2, canvas.height / 2 - bg.height / 2);
    });

    socket.on('sync with server', function(data) {
        numUsers = data[0].numUsers - 1;

        $numUsers.html('Osoby w pokoju: (' + numUsers + ')');

        for (var i = 0; i < data[0].users.length; i++) {
            if (data[0].users[i][2] == 1) {
                $users.append('<li class="' + data[0].users[i][1] + '">' + data[0].users[i][1] + ' [Admin]</li>');
            } else {
                $users.append('<li class="' + data[0].users[i][1] + '">' + data[0].users[i][1] + ' [User]</li>');
            }
        }

        var bg = new Image();
        bg.src = '/image/' + data[0].background;
        context.drawImage(bg, canvas.width / 2 - bg.width / 2, canvas.height / 2 - bg.height / 2);
    });

    socket.on('user joined', function(data) {
        numUsers++;

        $numUsers.html('Osoby w pokoju: (' + numUsers + ')');

        if (data.username != username) {
            if (data.permission == 1) {
                $users.append('<li class="' + data.username + '">' + data.username + ' [Admin]</li>');
            } else {
                $users.append('<li class="' + data.username + '">' + data.username + ' [User]</li>');
            }
        }
    });

    socket.on('user left', function(data) {
        numUsers--;

        $numUsers.html('Osoby w pokoju: (' + numUsers + ')');

        $('.' + data.username).remove();
    });

    socket.on('disconnect', function() {
        alert('Zostałeś rozłączony!');
    });

    socket.on('reconnect', function() {
        alert('Nastąpiło ponowne połączenie!');
        if (username) {
            socket.emit('add user', username);
        }
    });

    socket.on('reconnect_error', function() {
        alert('Ponowne połączenie nie powiodło się!');
    });

})(jQuery);