const express = require('express');
const Tag = require('../models/Tag');
const Thread = require('../models/Thread');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all tags with optional search
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, sort = 'usage' } = req.query;
    
    let query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    let sortOptions = {};
    switch (sort) {
      case 'alphabetical':
        sortOptions = { name: 1 };
        break;
      case 'recent':
        sortOptions = { createdAt: -1 };
        break;
      case 'usage':
      default:
        sortOptions = { usageCount: -1, name: 1 };
    }

    const tags = await Tag.find(query)
      .sort(sortOptions)
      .limit(parseInt(limit));

    res.json({
      tags: tags.map(tag => ({
        id: tag._id,
        name: tag.name,
        description: tag.description,
        usageCount: tag.usageCount,
        color: tag.color
      }))
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get popular tags
router.get('/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const tags = await Tag.find({ usageCount: { $gt: 0 } })
      .sort({ usageCount: -1 })
      .limit(limit);

    res.json({
      tags: tags.map(tag => ({
        id: tag._id,
        name: tag.name,
        usageCount: tag.usageCount,
        color: tag.color
      }))
    });
  } catch (error) {
    console.error('Get popular tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single tag with threads
router.get('/:tagId', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.tagId);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get threads with this tag
    const threads = await Thread.find({ tags: tag._id })
      .populate('author', 'username avatar reputation')
      .populate('category', 'name color')
      .populate('tags', 'name color')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Thread.countDocuments({ tags: tag._id });

    const threadsWithVotes = threads.map(thread => {
      const upvotes = thread.votes.filter(v => v.type === 'upvote').length;
      const downvotes = thread.votes.filter(v => v.type === 'downvote').length;
      
      return {
        id: thread._id,
        title: thread.title,
        content: thread.content.substring(0, 200) + '...',
        author: thread.author,
        category: thread.category,
        tags: thread.tags,
        voteScore: upvotes - downvotes,
        replyCount: thread.replies.length,
        views: thread.views,
        createdAt: thread.createdAt,
        lastActivity: thread.lastActivity
      };
    });

    res.json({
      tag: {
        id: tag._id,
        name: tag.name,
        description: tag.description,
        usageCount: tag.usageCount,
        color: tag.color,
        createdAt: tag.createdAt
      },
      threads: threadsWithVotes,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tag (admin only)
router.put('/:tagId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    if (!name || name.length < 1 || name.length > 30) {
      return res.status(400).json({ message: 'Tag name must be between 1 and 30 characters' });
    }

    const tag = await Tag.findById(req.params.tagId);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    // Check if new name conflicts with existing tag
    const normalizedName = name.toLowerCase().trim();
    if (normalizedName !== tag.name) {
      const existingTag = await Tag.findOne({ 
        name: normalizedName,
        _id: { $ne: tag._id }
      });

      if (existingTag) {
        return res.status(400).json({ message: 'Tag name already exists' });
      }
    }

    tag.name = normalizedName;
    if (description !== undefined) tag.description = description;
    if (color) tag.color = color;

    await tag.save();

    res.json({
      message: 'Tag updated successfully',
      tag: {
        id: tag._id,
        name: tag.name,
        description: tag.description,
        usageCount: tag.usageCount,
        color: tag.color
      }
    });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete unused tag (admin only)
router.delete('/:tagId', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.tagId);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }

    if (tag.usageCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete tag that is currently in use' 
      });
    }

    await Tag.findByIdAndDelete(req.params.tagId);

    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Merge tags (admin only)
router.post('/:tagId/merge', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { targetTagId } = req.body;
    
    if (!targetTagId) {
      return res.status(400).json({ message: 'Target tag ID is required' });
    }

    const sourceTag = await Tag.findById(req.params.tagId);
    const targetTag = await Tag.findById(targetTagId);

    if (!sourceTag || !targetTag) {
      return res.status(404).json({ message: 'One or both tags not found' });
    }

    if (sourceTag._id.toString() === targetTag._id.toString()) {
      return res.status(400).json({ message: 'Cannot merge tag with itself' });
    }

    // Update all threads using source tag to use target tag
    await Thread.updateMany(
      { tags: sourceTag._id },
      { $set: { "tags.$": targetTag._id } }
    );

    // Update target tag usage count
    targetTag.usageCount += sourceTag.usageCount;
    await targetTag.save();

    // Delete source tag
    await Tag.findByIdAndDelete(sourceTag._id);

    res.json({
      message: 'Tags merged successfully',
      targetTag: {
        id: targetTag._id,
        name: targetTag.name,
        usageCount: targetTag.usageCount
      }
    });
  } catch (error) {
    console.error('Merge tags error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tag suggestions based on partial input
router.get('/suggest/:partial', async (req, res) => {
  try {
    const partial = req.params.partial.toLowerCase();
    const limit = parseInt(req.query.limit) || 10;

    if (partial.length < 2) {
      return res.json({ suggestions: [] });
    }

    const tags = await Tag.find({
      name: { $regex: `^${partial}`, $options: 'i' }
    })
    .sort({ usageCount: -1, name: 1 })
    .limit(limit)
    .select('name usageCount');

    res.json({
      suggestions: tags.map(tag => ({
        name: tag.name,
        usageCount: tag.usageCount
      }))
    });
  } catch (error) {
    console.error('Tag suggestions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;