const express = require('express');
const Thread = require('../models/Thread');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateThread } = require('../middleware/validation');

const router = express.Router();

// Get all threads with filtering and pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      tags,
      sort = 'recent',
      search
    } = req.query;

    const skip = (page - 1) * limit;
    let query = {};
    let sortOptions = {};

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Search in title and content
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort options
    switch (sort) {
      case 'popular':
        sortOptions = { views: -1, createdAt: -1 };
        break;
      case 'votes':
        // This would need aggregation for proper vote sorting
        sortOptions = { createdAt: -1 };
        break;
      case 'recent':
      default:
        sortOptions = { isPinned: -1, lastActivity: -1 };
    }

    const threads = await Thread.find(query)
      .populate('author', 'username avatar reputation')
      .populate('category', 'name color')
      .populate('tags', 'name color')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Thread.countDocuments(query);

    // Add vote scores and user vote status
    const threadsWithVotes = threads.map(thread => {
      const upvotes = thread.votes.filter(v => v.type === 'upvote').length;
      const downvotes = thread.votes.filter(v => v.type === 'downvote').length;
      const voteScore = upvotes - downvotes;
      
      let userVote = null;
      if (req.user) {
        const vote = thread.votes.find(v => v.user.toString() === req.user._id.toString());
        userVote = vote ? vote.type : null;
      }

      return {
        id: thread._id,
        title: thread.title,
        content: thread.content.substring(0, 300) + (thread.content.length > 300 ? '...' : ''),
        author: thread.author,
        category: thread.category,
        tags: thread.tags,
        voteScore,
        userVote,
        replyCount: thread.replies.length,
        views: thread.views,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity
      };
    });

    res.json({
      threads: threadsWithVotes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new thread
router.post('/', authenticateToken, validateThread, async (req, res) => {
  try {
    const { title, content, category, tags } = req.body;

    // Verify category exists
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    // Process tags
    let tagIds = [];
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        let tag = await Tag.findOne({ name: tagName.toLowerCase() });
        if (!tag) {
          tag = new Tag({ name: tagName.toLowerCase() });
          await tag.save();
        }
        tag.usageCount += 1;
        await tag.save();
        tagIds.push(tag._id);
      }
    }

    // Create thread
    const thread = new Thread({
      title,
      content,
      author: req.user._id,
      category,
      tags: tagIds
    });

    await thread.save();

    // Update category thread count
    categoryDoc.threadCount += 1;
    await categoryDoc.save();

    // Populate and return
    await thread.populate([
      { path: 'author', select: 'username avatar reputation' },
      { path: 'category', select: 'name color' },
      { path: 'tags', select: 'name color' }
    ]);

    res.status(201).json({
      message: 'Thread created successfully',
      thread: {
        id: thread._id,
        title: thread.title,
        content: thread.content,
        author: thread.author,
        category: thread.category,
        tags: thread.tags,
        voteScore: 0,
        replyCount: 0,
        views: thread.views,
        createdAt: thread.createdAt
      }
    });
  } catch (error) {
    console.error('Create thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single thread by ID
router.get('/:threadId', optionalAuth, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId)
      .populate('author', 'username avatar reputation role')
      .populate('category', 'name color')
      .populate('tags', 'name color')
      .populate('replies.author', 'username avatar reputation role');

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Increment view count (only if not the author)
    if (!req.user || thread.author._id.toString() !== req.user._id.toString()) {
      thread.views += 1;
      await thread.save();
    }

    // Calculate vote scores and user votes
    const upvotes = thread.votes.filter(v => v.type === 'upvote').length;
    const downvotes = thread.votes.filter(v => v.type === 'downvote').length;
    const voteScore = upvotes - downvotes;
    
    let userVote = null;
    if (req.user) {
      const vote = thread.votes.find(v => v.user.toString() === req.user._id.toString());
      userVote = vote ? vote.type : null;
    }

    // Process replies with vote scores
    const processReplies = (replies) => {
      return replies.map(reply => {
        const replyUpvotes = reply.votes.filter(v => v.type === 'upvote').length;
        const replyDownvotes = reply.votes.filter(v => v.type === 'downvote').length;
        const replyVoteScore = replyUpvotes - replyDownvotes;
        
        let replyUserVote = null;
        if (req.user) {
          const vote = reply.votes.find(v => v.user.toString() === req.user._id.toString());
          replyUserVote = vote ? vote.type : null;
        }

        return {
          id: reply._id,
          content: reply.content,
          author: reply.author,
          voteScore: replyVoteScore,
          userVote: replyUserVote,
          parentReply: reply.parentReply,
          replies: processReplies(reply.replies || []),
          isEdited: reply.isEdited,
          editedAt: reply.editedAt,
          createdAt: reply.createdAt
        };
      });
    };

    res.json({
      thread: {
        id: thread._id,
        title: thread.title,
        content: thread.content,
        author: thread.author,
        category: thread.category,
        tags: thread.tags,
        voteScore,
        userVote,
        replies: processReplies(thread.replies),
        views: thread.views,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        isEdited: thread.isEdited,
        editedAt: thread.editedAt,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity
      }
    });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update thread (only by author or admin)
router.put('/:threadId', authenticateToken, validateThread, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Check permissions
    if (thread.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this thread' });
    }

    const { title, content, category, tags } = req.body;

    // Update basic fields
    thread.title = title;
    thread.content = content;
    thread.isEdited = true;
    thread.editedAt = new Date();

    // Update category if changed
    if (category !== thread.category.toString()) {
      const oldCategory = await Category.findById(thread.category);
      const newCategory = await Category.findById(category);
      
      if (!newCategory) {
        return res.status(400).json({ message: 'Invalid category' });
      }

      oldCategory.threadCount -= 1;
      newCategory.threadCount += 1;
      await oldCategory.save();
      await newCategory.save();
      
      thread.category = category;
    }

    // Update tags
    if (tags) {
      // Decrease usage count for old tags
      for (const oldTagId of thread.tags) {
        const tag = await Tag.findById(oldTagId);
        if (tag) {
          tag.usageCount = Math.max(0, tag.usageCount - 1);
          await tag.save();
        }
      }

      // Process new tags
      let tagIds = [];
      for (const tagName of tags) {
        let tag = await Tag.findOne({ name: tagName.toLowerCase() });
        if (!tag) {
          tag = new Tag({ name: tagName.toLowerCase() });
        }
        tag.usageCount += 1;
        await tag.save();
        tagIds.push(tag._id);
      }
      thread.tags = tagIds;
    }

    await thread.save();

    res.json({ message: 'Thread updated successfully' });
  } catch (error) {
    console.error('Update thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete thread (only by author or admin)
router.delete('/:threadId', authenticateToken, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Check permissions
    if (thread.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this thread' });
    }

    // Update category thread count
    const category = await Category.findById(thread.category);
    if (category) {
      category.threadCount = Math.max(0, category.threadCount - 1);
      await category.save();
    }

    // Update tag usage counts
    for (const tagId of thread.tags) {
      const tag = await Tag.findById(tagId);
      if (tag) {
        tag.usageCount = Math.max(0, tag.usageCount - 1);
        await tag.save();
      }
    }

    await Thread.findByIdAndDelete(req.params.threadId);

    res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;