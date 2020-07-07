//express setup
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const app = require('express')();
const http = require('http').createServer(app);

//Client and NS communications
const io = require('socket.io')(http);
const mqtt = require("mqtt");

//setting up the DB
const mongoose = require('mongoose');
const id = mongoose.Types.ObjectId;
mongoose.connect("mongodb+srv://taras:tektelic@cluster0-5jzvv.mongodb.net/test?retryWrites=true&w=majority",
    {useUnifiedTopology: true, useNewUrlParser: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
const Event = require("./models/event");
const User = require("./models/user");

const devices = [
  {deveui: "647FDA000000589A", mac: "14B45790D667", name: "Person A"},
  {deveui: "647FDA0000005974", mac: "14B45790DC1A", name: "Person B"},
  {deveui: "647FDA000000597F", mac: "14B45790D5A4", name: "Person C"},
  //{deveui: "647FDA0000005974", mac: "14B45790DC1A", name: "Person D"},
  // {deveui: "647FDA0000005892", mac: "14B45790D659", name: "Person E"},
  // {deveui: "", mac: "", name: "Person F"},
  // {deveui: "", mac: "", name: "Person G"},
  // {deveui: "", mac: "", name: "Person H"},
  // {deveui: "", mac: "", name: "Person J"},
  // {deveui: "", mac: "", name: "Person I"},
  // {deveui: "", mac: "", name: "Person K"},
  // {deveui: "", mac: "", name: "Person L"},
]

// // uncomment to set up the database with devices
// for (var i = 0; i < devices.length; i++) {
//   User.create({
//     deveui: devices[i].deveui,
//     mac: devices[i].mac,
//     name: devices[i].name
//   })
// }

//for calculations
const decode = require("./helpers/uplink_ble_tracker");
const whiteListAndAverage = require("./helpers/whiteListAndAverage");
const whiteList = [
/*  { mac: 'ac233f5b8cb7', name: "Beacon 1"},
  { mac: 'ac233f5b8cbc', name: "Beacon 2"},
  { mac: 'ac233f5b8bb2', name: "Beacon 3"},
  { mac: 'ac233f5b8bb0', name: "Beacon 4"},
  { mac: 'ac233f5b8cb6', name: "Beacon 5"},
  { mac: 'ac233f5b8ba6', name: "Beacon 6"},
  { mac: 'ac233f5b8cad', name: "Beacon 7"},
  { mac: 'ac233f5b8bab', name: "Beacon 8"},
  { mac: 'ac233f5b8cbb', name: "Beacon 9"},
  { mac: 'ac233f5b8baf', name: "Beacon 10"},
  { mac: 'ac233f5b8cb0', name: "Beacon 11"},
  { mac: 'ac233f5b8caf', name: "Beacon 12"},
  { mac: 'ac233f5b8cb2', name: "Beacon 13"},
  { mac: 'ac233f5b8cb3', name: "Beacon 14"},
  { mac: 'ac233f5b8cba', name: "Beacon 15"}*/
].concat(devices)

http.listen(2000)

const mqttClient = mqtt.connect("https://lorawan-ns-eu.tektelic.com",
    {"username": "contact", "password": "please work"});

mqttClient.on("connect", ()=> {
  mqttClient.subscribe("app/#")
});

let events = Object.fromEntries(devices.map(el => [el.deveui, {lastEvents: []}]))

let users = []

console.log(events)

mqttClient.on("message", async function (topic, message) {
  const receivedObject = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(message)));
  if (receivedObject.hasOwnProperty("payloadMetaData")) {

    let payload = receivedObject.payload
    let port = receivedObject.payloadMetaData.fport
    let deveui = receivedObject.payloadMetaData.deviceMetaData.deviceEUI

    //TODO: separate the code below based on DEVEUI, since otherwise lastEvents makes no sense.

    const data = decode(payload, port);
    const detectedDevices = whiteListAndAverage(data, whiteList);

    events[deveui]["newEvents"] = [];
    events[deveui]["continueEvents"] = [];

    for (var i = 0; i < detectedDevices.length; i++) {
      if (detectedDevices[i].avg > -70 && detectedDevices[i].rssi !== null) {
        let newEvent = {
          sender: (await User.find({"deveui": deveui}).limit(1))[0],
          found: (await User.find({"mac": detectedDevices[i].mac}).limit(1))[0],
          rssi: detectedDevices[i].avg,
          timestamp_start: Date.now(),
          _id: id()
        }
        events[deveui]["newEvents"].push(newEvent)
      }
    }

    for (let i = 0; i < events[deveui]["lastEvents"].length;) { //find events to continue
      let elementDeleted = false

      for (let j = 0; j < events[deveui]["newEvents"].length;) {
        if (events[deveui]["lastEvents"][i].found._id.toString() === events[deveui]["newEvents"][j].found._id.toString()
            && events[deveui]["lastEvents"][i].sender._id.toString() === events[deveui]["newEvents"][j].sender._id.toString()){

          events[deveui]["continueEvents"].push(events[deveui]["lastEvents"][i])
          events[deveui]["lastEvents"].splice(i, 1);
          events[deveui]["newEvents"].splice(j, 1);
          elementDeleted = true;
          break;
        }
        j++;
      }
      if (!elementDeleted)
        i++
    }

    for (let i = 0; i < events[deveui]["lastEvents"].length; i++){ //end events that aren't continued
      await Event.updateOne({_id: events[deveui]["lastEvents"][i]._id}, {timestamp_end: Date.now()})
    }

    for (let i = 0; i < events[deveui]["newEvents"].length; i++){ //create new events
      Event.create(events[deveui]["newEvents"][i])
    }

    events[deveui]["lastEvents"] = events[deveui]["continueEvents"].concat(events[deveui]["newEvents"]);

  }

});

// let relationships = Object.fromEntries(devices.map(el => [el.deveui, {timeTotal: 0, timestampLatest: 0}]))

io.on("connect", async (socket) => {
  socket.on("getUsers", async () => {
    users = await User.find()
    socket.emit("users", users)
  });

  socket.on("getEvents", async (user) => {
    let search = {};
    if (user.hasOwnProperty("id")){
      search = {"found.id": user.id}
    } else if (user.hasOwnProperty("deveui")){
      search = {"sender.deveui": user.deveui}
    }

    let events = await Event.find(search).sort({$natural:-1}).limit(20)
    socket.emit("events", events)
  })

  socket.on("getRelationships", async (user) => {

    if (users.length === 0) {
      users = await User.find();
    }
    let relationships = []
    for (let i = 0; i < users.length; i++) {
      if (users[i].deveui!==user.deveui){
        let search = {"sender.deveui": user.deveui, "found.deveui": users[i].deveui}
        let relationshipEvents = await Event.find(search).sort({$natural:-1})//.limit(18)
        let totalTime = 0;
        let timestampLatest = 0;
        //console.log(relationshipEvents)
        for (let j = 0; j < relationshipEvents.length; j++) {
          if (relationshipEvents[j].timestamp_end) {
          //if (relationshipEvents[j].hasOwnProperty("timestamp_end")){
            //TODO: this is retarded. this shit is always false. WHY?
            totalTime += relationshipEvents[j].timestamp_end-relationshipEvents[j].timestamp_start
            if (timestampLatest < relationshipEvents[j].timestamp_end){
              timestampLatest = relationshipEvents[j].timestamp_end
            }
          } else {
            if (timestampLatest < relationshipEvents[j].timestamp_start){
              timestampLatest = relationshipEvents[j].timestamp_start
            }
          }
        }

        relationships.push({
          found: users[i],
          totalTime: totalTime,
          timestampLatest: timestampLatest,
          events: relationshipEvents,
          totalEvents: relationshipEvents.length
        })
      }
    }
    console.log(relationships)
    socket.emit("relationships", relationships)

  })

  console.log("connected react")
});

module.exports = app;
