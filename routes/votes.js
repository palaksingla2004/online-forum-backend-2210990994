const express = require('express');
const Thread = require('../models/Thread');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Vote on thread
router.post('/threads/:threadId', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body; // 'upvote' or 'downvote'
    
    if (!['upvote', 'downvote'].includes(type)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Check if user already voted
    const existingVoteIndex = thread.votes.findIndex(
      vote => vote.user.toString() === req.user._id.toString()
    );

    let voteChange = 0;
    
    if (existingVoteIndex !== -1) {
      const existingVote = thread.votes[existingVoteIndex];
      
      if (existingVote.type === type) {
        // Remove vote if same type
        thread.votes.splice(existingVoteIndex, 1);
        voteChange = type === 'upvote' ? -1 : 1;
      } else {
        // Change vote type
        existingVote.type = type;
        voteChange = type === 'upvote' ? 2 : -2;
      }
    } else {
      // Add new vote
      thread.votes.push({
        user: req.user._id,
        type
      });
      voteChange = type === 'upvote' ? 1 : -1;
    }

    await thread.save();

    // Update author reputation
    const author = await User.findById(thread.author);
    if (author) {
      author.reputation = Math.max(0, author.reputation + voteChange);
      await author.save();
    }

    // Calculate new vote score
    const upvotes = thread.votes.filter(v => v.type === 'upvote').length;
    const downvotes = thread.votes.filter(v => v.type === 'downvote').length;
    const voteScore = upvotes - downvotes;

    // Get user's current vote
    const userVote = thread.votes.find(v => v.user.toString() === req.user._id.toString());

    res.json({
      message: 'Vote recorded successfully',
      voteScore,
      userVote: userVote ? userVote.type : null
    });
  } catch (error) {
    console.error('Thread vote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Vote on reply
router.post('/threads/:threadId/replies/:replyId', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body;
    
    if (!['upvote', 'downvote'].includes(type)) {
      return res.status(400).json({ message: 'Invalid vote type' });
    }

    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Find and update reply vote
    const findAndVoteReply = (replies) => {
      for (let reply of replies) {
        if (reply._id.toString() === req.params.replyId) {
          // Check if user already voted on this reply
          const existingVoteIndex = reply.votes.findIndex(
            vote => vote.user.toString() === req.user._id.toString()
          );

          let voteChange = 0;
          
          if (existingVoteIndex !== -1) {
            const existingVote = reply.votes[existingVoteIndex];
            
            if (existingVote.type === type) {
              // Remove vote if same type
              reply.votes.splice(existingVoteIndex, 1);
              voteChange = type === 'upvote' ? -1 : 1;
            } else {
              // Change vote type
              existingVote.type = type;
              voteChange = type === 'upvote' ? 2 : -2;
            }
          } else {
            // Add new vote
            reply.votes.push({
              user: req.user._id,
              type
            });
            voteChange = type === 'upvote' ? 1 : -1;
          }

          return { reply, voteChange };
        }
        
        if (reply.replies && reply.replies.length > 0) {
          const result = findAndVoteReply(reply.replies);
          if (result) return result;
        }
      }
      return null;
    };

    const result = findAndVoteReply(thread.replies);
    if (!result) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    await thread.save();

    // Update reply author reputation
    const author = await User.findById(result.reply.author);
    if (author) {
      author.reputation = Math.max(0, author.reputation + result.voteChange);
      await author.save();
    }

    // Calculate new vote score
    const upvotes = result.reply.votes.filter(v => v.type === 'upvote').length;
    const downvotes = result.reply.votes.filter(v => v.type === 'downvote').length;
    const voteScore = upvotes - downvotes;

    // Get user's current vote
    const userVote = result.reply.votes.find(v => v.user.toString() === req.user._id.toString());

    res.json({
      message: 'Vote recorded successfully',
      voteScore,
      userVote: userVote ? userVote.type : null
    });
  } catch (error) {
    console.error('Reply vote error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get vote statistics for a thread
router.get('/threads/:threadId/stats', async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const upvotes = thread.votes.filter(v => v.type === 'upvote').length;
    const downvotes = thread.votes.filter(v => v.type === 'downvote').length;

    // Calculate reply vote stats
    const calculateReplyStats = (replies) => {
      let totalReplyUpvotes = 0;
      let totalReplyDownvotes = 0;
      
      replies.forEach(reply => {
        totalReplyUpvotes += reply.votes.filter(v => v.type === 'upvote').length;
        totalReplyDownvotes += reply.votes.filter(v => v.type === 'downvote').length;
        
        if (reply.replies && reply.replies.length > 0) {
          const nestedStats = calculateReplyStats(reply.replies);
          totalReplyUpvotes += nestedStats.upvotes;
          totalReplyDownvotes += nestedStats.downvotes;
        }
      });
      
      return { upvotes: totalReplyUpvotes, downvotes: totalReplyDownvotes };
    };

    const replyStats = calculateReplyStats(thread.replies);

    res.json({
      thread: {
        upvotes,
        downvotes,
        score: upvotes - downvotes
      },
      replies: {
        upvotes: replyStats.upvotes,
        downvotes: replyStats.downvotes,
        score: replyStats.upvotes - replyStats.downvotes
      },
      total: {
        upvotes: upvotes + replyStats.upvotes,
        downvotes: downvotes + replyStats.downvotes,
        score: (upvotes - downvotes) + (replyStats.upvotes - replyStats.downvotes)
      }
    });
  } catch (error) {
    console.error('Vote stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;