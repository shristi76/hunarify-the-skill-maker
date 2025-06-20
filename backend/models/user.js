const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  selectedCategory: String,
  selectedSubField: String,
  testResult: Number,
  testTime: Number // <--- Add this line
});

module.exports = mongoose.model('User', UserSchema);
