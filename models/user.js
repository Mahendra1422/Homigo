const { required } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email : {
        type : String ,
        required :true ,
    },
});

userSchema.plugin(passportLocalMongoose); // Used because it automatically implements the Username , Hashing and Salting

module.exports = mongoose.model('User' , userSchema);














