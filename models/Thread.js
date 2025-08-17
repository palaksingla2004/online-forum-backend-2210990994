const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['upvote', 'downvote'],
    required: true
  }
}, { _id: false });

const replySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  votes: [voteSchema],
  parentReply: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  replies: [this], // Self-reference for nested replies
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const threadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }],
  votes: [voteSchema],
  replies: [replySchema],
  views: {
    type: Number,
    default: 0
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for vote score
threadSchema.virtual('voteScore').get(function() {
  const upvotes = this.votes.filter(vote => vote.type === 'upvote').length;
  const downvotes = this.votes.filter(vote => vote.type === 'downvote').length;
  return upvotes - downvotes;
});

// Virtual for reply count
threadSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Update lastActivity when replies are added
threadSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.lastActivity = new Date();
  }
  next();
});

module.exports = mongoose.model('Thread', threadSchema);