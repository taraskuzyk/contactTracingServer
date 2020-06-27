var mongoose = require('mongoose')
var Schema = mongoose.Schema;

const userSchema = new Schema({
    mac: String,
    deveui: String,
    name: String,
});

module.exports = mongoose.model('user', userSchema)
