var port = 8088;
var duration = {
    track: 35,
    timeline: 60,
    mario: 45,
};
var names = [
    'Ludwig',
    'Erik',
    'Friedrich',
    'Wolfgang',
    'Serge',
    'Georges',
    'Ella',
    'Camille',
    'Tina',
    'Madonna',
    'Dalida',
    'Jane',
];
const { execSync } = require('child_process');
var io = require('socket.io')(port);

function getRandomInt(min, max) {
    min = Math.ceil(min); // inclusive
    max = Math.floor(max); // exclusive
    return Math.floor(Math.random() * (max - min)) + min;
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

var rankings = {};
var question = null;
var start = null;
var answers = {};

function makeQuestion() {
    var str = execSync('python maker.py')
    var d = JSON.parse(str);
    question = d;
    var n = new Date();
    start = n.getTime() / 1000;
    answers = {};
    console.log('new question');
}

function sendQuestion() {
    makeQuestion();
    var d = Object.assign({}, question, {
        good: null,
        time: duration[question.type],
    });
    io.sockets.emit('question', d);
    sendRankings();
    setTimeout(sendQuestion, duration[question.type] * 1000);
}

function sendRankings(socket) {
    var r = [];
    for (var a in rankings) {
        if (!rankings.hasOwnProperty(a)) {
            continue;
        }
        r.push({
            id: a,
            score: rankings[a].score,
            avatar: rankings[a].avatar,
            name: rankings[a].name,
        });
    }
    r.sort((a, b) => {
        return a.score < b.score;
    });
    if (socket) {
        socket.emit('rankings', r);
    } else {
        io.sockets.emit('rankings', r);
    }
}

function addScore(socket) {
    if (!rankings[socket.id]) {
        rankings[socket.id] = {
            score: 0,
            avatar: getRandomInt(0, 6),
            name: names[getRandomInt(0, names.length - 1)],
        };
    }
    var n = new Date();
    n = n.getTime() / 1000;
    rankings[socket.id].score += Math.round(100 * (start + duration[question.type] - n) / duration[question.type]);
}

io.on('connection', (socket) => {
    console.log('user connected');
    if (question) {
        var n = new Date();
        var d = Object.assign({}, question, {
            good: null,
            time: Math.round(start + duration[question.type] - n.getTime() / 1000),
        });
        socket.emit('question', d);
    }
    rankings[socket.id] = {
        score: 0,
        avatar: getRandomInt(0, 6),
        name: names[getRandomInt(0, names.length - 1)],
    };
    sendRankings(socket);
    socket.on('answer', (answer) => {
        if (!answers[socket.id]) {
            answers[socket.id] = true;
            if (question.type == 'timeline') {
                var good = true;
                if (answer.length != question.good.length) {
                    good = false;
                }
                for (var i = 0; i < question.good.length; i++) {
                    if (answer[i] != question.good[i].id) {
                        good = false;
                    }
                }
                if (good) {
                    addScore(socket);
                    socket.emit('result', true, question.good);
                } else {
                    socket.emit('result', false, question.good);
                }
            } else if (question.type == 'track') {
                if (answer == question.good.id) {
                    addScore(socket);
                    socket.emit('result', true, question.good);
                } else {
                    socket.emit('result', false, question.good);
                }
            }
            sendRankings(socket);
        }
    });
    socket.on('disconnect', () => {
        delete rankings[socket.id];
        console.log('user disconnected');
    });
});

console.log('listening on ' + port);

sendQuestion();
