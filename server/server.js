// Stores Organizations schedule data in firebase database
const firebase = require('firebase');
const sparkCreds = require('./ciscosparkSecret');
const firebaseCreds = require('./firebaseSecret');
const serverCreds = require('./serverSecret');

'use strict';

// set data here, could use environmental variables to simplify this step -- begin
const BOTTOKEN = sparkCreds.clientId; // set the bots auth token to constant
const SERVER = serverCreds.clientId; // the url to your webhook receiving server
const FIREKEY = firebaseCreds.clientId;
// set data here, could use environmental variables to simplify this step -- end

const EXPRESS = require('express'); // used as the webserver
const BODYPARSER = require('body-parser'); // interprets body read by express
const SPARK = require('ciscospark'); // the nodejs cisco spark sdk

// initialize a firebase instance

firebase.initializeApp({
    appName: "schedulus-ayy",
    apiKey: FIREKEY,
    authDomain: "schedulus-ayy.firebaseapp.com",
    databaseURL: "https://schedulus-ayy.firebaseio.com",
    projectId: "schedulus-ayy",
    storageBucket: "schedulus-ayy.appspot.com",
    messagingSenderId: "839269987435"
});

var ref = firebase.app().database().ref('/Employees');

function getSchedule(i, name, callback) {
    ref.once('value')
        .then(function (snap) {
            var data = parseSchedule(snap.val(), i, name);
            callback(null, data);
        })
        .catch((error) => {
            console.log(".ONCE FAILED:", error);
            callback('error', null);
        });
}

function removeEmployee(name){
    firebase.database().ref('/Employees/'+name).remove();
}

function setSchedule(name, day, time, callback) {
    // update schedule for prompted user
    firebase.database().ref('/Employees/' + name).update({ [day]: time }, function (err, res) {
        if (err) {
            console.error("failed to update schedule");
        }
        else {
            callback(null, res);
        }
    })
}

function setFullWeek(name, callback) {
    console.log("reached setFullWeek");
    // deletes previous weeks employee schedules
    firebase.database().ref('/Employees/' + name).update({
        "Sunday": "9:00-17:00",
        "Monday": "9:00-17:00",
        "Tueday": "9:00-17:00",
        "Wednesday": "9:00-17:00",
        "Thursday": "9:00-17:00",
        "Friday": "9:00-17:00",
        "Saturday": "9:00-17:00"
    }, function (err, res) {
        if (err) {
            console.error("failed to upload full week schedule");
        }
        else {
            callback(null, res);
        }
    })
}

function setNewWeek(callback) {
    // deletes previous weeks employee schedules
    firebase.database().ref('/Employees/').update({}, function (err, res) {
        if (err) {
            console.error("failed to delete previous schedule");
        }
        else {
            callback(null, res);
        }
    })
}

function addEmployee(name, callback) {

    firebase.database().ref('/Employees/' + name).update({
        "Sunday": "OFF",
        "Monday": "OFF",
        "Tueday": "OFF",
        "Wednesday": "OFF",
        "Thursday": "OFF",
        "Friday": "OFF",
        "Saturday": "OFF"
    }, function (err, res) {
        if (err) {
            console.error("failed to update schedule");
        }
        else {
            callback(null, res);
        }
    })
}


// initialize application -- begin
let webApp = EXPRESS(); // construct the web webserver
webApp.use(BODYPARSER.json()); // instruct the web app to read json through the helper library, "body-parser"
let sparkBot = new SPARK.init({ "credentials": { "access_token": BOTTOKEN } }); // initilize a new botToken
let sparkBotID = ""; // stores the id of the spark bot
let sparkBotWH = ""; // stores the id of the webhook the bot uses
// initialize application -- end

sparkBot.once('ready', () => { // handle on bot ready
    initBot().then((r) => { // perform initialization of the bot via cisco spark
        console.log('app ready'); // print if the bot is fully ready;
        main();
    }).catch((e) => {
        throw e; // throw an error if it doesn't succeed
        console.log("APP WASNT RDY ", e);
    });
});

function initBot() {
    return new Promise((resolve, reject) => {
        sparkBot.webhooks.create({ // create a webhook that targets your server
            "resource": "messages",
            "event": "created",
            "name": `mchack`,
            "targetUrl": `${SERVER}/spark`// sets the target to the /webhook endpoint on your server
        }).then((r) => {
            sparkBotWH = r.id;
            sparkBot.people.get('me').then((r) => {
                sparkBotID = r.id;
                main();
                resolve(r); // resolves
            }).catch((e) => {
                reject(e); // rejects on failed information received
            });
        }).catch((e) => {
            reject(e); // rejects on failed webhook creation
        });
    });
}

function stopBot() {
    return new Promise((resolve, reject) => {
        sparkBot.webhooks.remove(sparkBotWH).then((r) => { resolve(); }).catch((e) => { throw e; });
    });
}

function forward(post, response) {
    // send the message back
    sparkBot.messages.create(post).then((r) => {
        response.sendStatus(200); // respond with 200 to api.ciscospark.com
    }).catch((e) => {
        response.sendStatus(503); // if the message fails to send, respond with 503
        throw e;
    });
}

function extractFstName(comment) {
    // hacky way of getting firstname
    var fstName = comment.replace('-', ' ');
    fstName = fstName.split(' ')[1];
    return fstName;
}

function capitalizeFirstLetter(string) {
    console.log("STRING = " + string);
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function main() {
    webApp.post('/spark', (request, response) => { // when a bot receives a message, do this

        if (request.body.data.personId == sparkBotID) { return; } // return if it's a bot's message, to prevent an infinte loop

        // We will echo the message sent back for this demo:
        sparkBot.messages.get(request.body.data.id).then((r) => { // get the message details to echo back
            var comment = r.text;

            if (comment[0] === " ") {
                comment = comment.substring(1);
            }

            console.log("original comment = " + comment);
            var post = { "roomId": r.roomId };
            console.log(post);
            console.log("reaches before comment decisions")

            // BEWARE @schedulus -schedule is the first if although its the second command in README

            if (comment.indexOf("-schedule") !== -1) {
                var fstName = extractFstName(comment);
                getSchedule(1, fstName, function (err, res) {
                    post["markdown"] = res;
                    forward(post, response);
                });
            }
            else if (comment.indexOf("schedule") !== -1) {
                getSchedule(0, null, function (err, res) {
                    post["markdown"] = res;
                    forward(post, response);
                })
            }
            else if (comment.indexOf("-away") !== -1) {

                var data = comment.replace(/-/g, " ");
                data = data.split(' ')

                var fstName = capitalizeFirstLetter(data[1]);
                var day = capitalizeFirstLetter(data[2]);

                var start_time = data[3];
                var end_time = data[4];

                setSchedule(fstName, day, "OFF", function (err, res) {
                    post["markdown"] = 'Ok, removing shift for ' + fstName + ' on ' + day;
                    forward(post, response);
                });
            }
            else if (comment.indexOf("-take") !== -1) {
                console.log("comment = " + comment);
                var data = comment.replace(/-/g, " ");
                data = data.split(' ')
                console.log(data);

                var fstName = capitalizeFirstLetter(data[1]);
                var day = capitalizeFirstLetter(data[2]);

                var start_time = data[3];
                var end_time = data[4];

                var time = start_time + "-" + end_time;

                setSchedule(fstName, day, time, function (err, res) {
                    post["markdown"] = 'Ok, adding ' + time + ' shift on ' + day + ' for ' + fstName;
                    forward(post, response);
                });
            }
            else if (comment.indexOf("-fullweek") !== -1) {
                var data = comment.replace(/-/g, " ");
                data = data.split(' ');

                var fstName = capitalizeFirstLetter(data[1]);
                setFullWeek(fstName, function (err, res) {
                    post["markdown"] = res;
                    forward(post, response);
                });
            }
            else if (comment.indexOf("-newweek") !== -1) {
                setNewWeek(function (err, res) {
                    post["markdown"] = "New Week New Me!"
                    forward(post, response);
                });
            }
            else if (comment.indexOf("info") !== -1 || comment.indexOf("hi") !== -1 || comment.indexOf("hello") !== -1) {
                post["markdown"] = "Hi there! Type: \n * '@Schedulus schedule' For the all employees schedule \n * '@Schedulus Firstname-schedule' For your own schedule \n * '@Schedulus Firstname-Weekday-away' To drop your shift on that day \n * '@Schedulus Firstname-Weekday-(hh:mm-hh:mm)-take' To take that shift \n * '@Schedulus Firstname-add' To add a new employee \n * '@Schedulus -fullweek' to set all employee hours from 9:00-5:00";
                forward(post, response);
            }
            else if (comment.indexOf("-add") !== -1) {
                var data = comment.replace(/-/g, " ");
                data = data.split(' ');

                var fstName = capitalizeFirstLetter(data[1]);

                addEmployee(fstName, function (err, res) {
                    post["markdown"] = "Added " + fstName + " to the Employee list";
                    forward(post, response);
                })
            } else if (comment.indexOf("-delete") !== -1){
                var data = comment.replace(/-/g, " ");
                data = data.split(' ');

                var fstName = capitalizeFirstLetter(data[1]);
                removeEmployee(fstName);
                post["markdown"] = fstName + ' has been removed from the schedule';
                forward(post, response);
            }
            else {
                post["markdown"] = "INVALID COMMAND";
                forward(post, response);
            }
        }).catch((e) => {
            response.sendStatus(503); // if getting message details fails, respond with 503
            throw e;
        });
    });
}

// exit handler -- begin
// this prevents webhooks from infinitely staying on api.ciscospark.com for your bot

function exitHandler(options, err) {
    stopBot().then((r) => {
        if (options.cleanup) console.log('clean');
        if (err) console.log(err.stack);
        if (options.exit) process.exit();
    });
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

// exit handler -- end

function getKeys(json) {
    var keys = []
    for (k in json) {
        keys.push(k);
    }
    return keys
}

function parseSchedule(json, status, name = null) {
    var returnText = '';
    if (status == 0 && json != null) {
        var num = 1;
        for (var emname in json) {
            var days = getKeys(json[emname]);
            var dayLen = days.length;
            returnText += (`\n \n ${ num }.`+ emname + '\n');
            for (var i = 0; i < dayLen; i++) {
                returnText += ('\n \t' + days[i] + ' : ' + json[emname][days[i]]);
            }
            num++;
        }
    } else if (status == 1 && json != null) {
        var days = getKeys(json[name]);
        var dayLen = days.length;
        returnText += '\n' + name + '\n';
        for (var i = 0; i < dayLen; i++) {
            returnText += ('\n * ' + days[i] + ' : ' + json[name][days[i]]);
        }
    } else {
        returnText = 'Something went wrong!';
    }
    console.log("returnText contains = " + returnText);
    return returnText;
}


webApp.listen(8080);
