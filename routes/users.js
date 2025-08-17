const express = require('express');
const User = require('../models/User');
const Thread = require('../models/Thread');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Get user profile by ID
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email');

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's thread count
    const threadCount = await Thread.countDocuments({ author: user._id });

    // Get user's total reply count
    const threads = await Thread.find({}, 'replies');
    let replyCount = 0;
    threads.forEach(thread => {
      replyCount += thread.replies.filter(reply => 
        reply.author.toString() === user._id.toString()
      ).length;
    });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        reputation: user.reputation,
        role: user.role,
        joinedAt: user.joinedAt,
        threadCount,
        replyCount
      }
    });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, bio, avatar } = req.body;
    const updateData = {};

    if (username && username !== req.user.username) {
      // Check if username is already taken
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateData.username = username;
    }

    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's threads
router.get('/:userId/threads', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const threads = await Thread.find({ author: req.params.userId })
      .populate('author', 'username avatar')
      .populate('category', 'name color')
      .populate('tags', 'name color')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Thread.countDocuments({ author: req.params.userId });

    res.json({
      threads: threads.map(thread => ({
        id: thread._id,
        title: thread.title,
        content: thread.content.substring(0, 200) + '...',
        author: thread.author,
        category: thread.category,
        tags: thread.tags,
        voteScore: thread.voteScore,
        replyCount: thread.replyCount,
        views: thread.views,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity
      })),
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('User threads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users
router.get('/', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = { isActive: true };
    if (q) {
      query.username = { $regex: q, $options: 'i' };
    }

    const users = await User.find(query)
      .select('username avatar reputation role joinedAt')
      .sort({ reputation: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;