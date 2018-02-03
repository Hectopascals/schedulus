var express = require('express')
var app = express()

// Stores Organizations schedule data in firebase database
var firebase = require('firebase');


// GET request for homepage
app.get('/', function (req, res) {
  res.send('GET request to the homepage')
})


//listener
app.listen(8080, function () {
  console.log('Example app listening on port 8080!')
})