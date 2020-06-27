var mongoose = require('mongoose')
var Schema = mongoose.Schema;
//var userSchema = require('./user')

const eventSchema = new Schema({
    sender: {
        _id: Schema.ObjectId,
        id: String,
        deveui: String,
        name: String,
    },
    found: {
        _id: Schema.ObjectId,
        id: String,
        deveui: String,
        name: String,
    },
    rssi: Number,
    timestamp_start: Number,
    timestamp_end: Number,
});

module.exports = mongoose.model('event', eventSchema)


