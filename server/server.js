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

function main() {
    webApp.post('/spark', (request, response) => { // when a bot receives a message, do this

        if (request.body.data.personId == sparkBotID) { return; } // return if it's a bot's message, to prevent an infinte loop

        sparkBot.messages.get(request.body.data.id).then((r) => {
            var currUserId = r.personId;

            // this is how u make a GET request passing in some hardcoded authorization
            var displayName;
            var http = require("https");
            // *** Bearer should not be explicit!!! *** IT IS THE ACCESS TOKEN
            var options = {
                "method": "GET",
                "hostname": "api.ciscospark.com",
                "port": null, "path": "/v1/people/" + currUserId,
                "headers": {
                    "authorization": "Bearer MDBiOWQ1ODMtNzQ1YS00MzFlLTllNWEtMTA2MWY5NmU4ZjExZThmNDIxMGEtMjZh",
                    "cache-control": "no-cache", "postman-token": "a88bb604-cf15-f9a5-f4e2-03a24a5a9083"
                },
            };
            // needa use this GET request to get the user email
            var req = http.request(options, function (res) {
                var chunks = []; res.on("data", function (chunk) {
                    chunks.push(chunk);
                });
                res.on("end", function () {
                    var body = Buffer.concat(chunks);
                    displayName = JSON.parse(body.toString())["displayName"].split(" ")[0];

                    // do the DB stuff here
                    var db = firebase.database();
                    // this line will update displayName's (currentUser) Monday: UPDATED
                    db.ref('/Employees/' + displayName).update({ Monday: "ASDASLKDJ", Friday: "7:00-8:00" });
                    console.log("UPDATED DB!!");
                });
            });
            req.end();
        });


        // We will echo the message sent back for this demo:
        sparkBot.messages.get(request.body.data.id).then((r) => { // get the message details to echo back
            var comment = r.text;
            var post = { "roomId": r.roomId };
            console.log(post);
            console.log("reaches before comment decisions")

            // BEWARE @schedulus -schedule is the first if although its the second command in README

            if (comment.indexOf("-schedule") !== -1) {
                
                // hacky way of getting firstname
                var fstName = comment.replace('-', ' ');
                console.log("FSTNAME IS = " + fstName);
                fstName = fstName.split(' ')[1]; 

                var res = getSchedule(1, fstName, function (err, res) {
                    post["markdown"] = res;
                    forward(post, response);
                });
            }
            else if (comment.indexOf("schedule") !== -1) {
                var res = getSchedule(0, null, function (err, res) {
                    post["markdown"] = res;
                    forward(post, response);
                })
            }
            else if (comment.indexOf("-away") !== -1) {
                post["markdown"] = "mark me away";
            }
            else if (comment.indexOf("-take") !== -1) {
                post["markdown"] = "take this shift";
            }
            else {
                post["markdown"] = "INVALID COMMAND";
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

function parseSchedule(json, status, name = null) {
    var returnText = '';
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var dayLen = 7;
    if (status == 0 && json != null) {
        for (var emname in json) {
            returnText += ('\n \n' + emname + '\n');
            for (var i=0; i<dayLen; i++) {
                returnText += ('\n' + days[i] + ' : ' + json[emname][days[i]]);
            }
        }
    } else if (status == 1 && json != null) {
        returnText += '\n' + name + '\n';
        for (var i=0; i<dayLen; i++) {
            returnText += ('\n' + days[i] + ' : ' + json[name][days[i]]);
        }
    } else if (status == 2) {
        returnText = 'Ok, removing shift!';
    } else if (status == 3) {
        returnText = 'Ok, adding shift!';
    } else {
        returnText = 'Something went wrong!';
    }
    return returnText;
}


webApp.listen(8080);
