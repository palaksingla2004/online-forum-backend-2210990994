const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 30
  },
  description: {
    type: String,
    maxlength: 100
  },
  usageCount: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#6c757d'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Tag', tagSchema);