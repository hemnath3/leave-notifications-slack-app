const express = require('express');
const Leave = require('../models/Leave');
const router = express.Router();

// Get all leaves for a channel
router.get('/channel/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { startDate, endDate, status } = req.query;
    
    let query = { channelId };
    
    if (startDate && endDate) {
      query.startDate = { $lte: new Date(endDate) };
      query.endDate = { $gte: new Date(startDate) };
    }
    
    if (status) {
      query.status = status;
    }
    
    const leaves = await Leave.find(query).sort({ startDate: 1 });
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's leaves for a channel
router.get('/today/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const leaves = await Leave.getTodaysLeaves(channelId);
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching today\'s leaves:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaves for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;
    
    let query = { userId };
    if (status) {
      query.status = status;
    }
    
    const leaves = await Leave.find(query).sort({ startDate: -1 });
    res.json(leaves);
  } catch (error) {
    console.error('Error fetching user leaves:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new leave request
router.post('/', async (req, res) => {
  try {
    const leaveData = req.body;
    
    // Validate required fields
    if (!leaveData.userId || !leaveData.leaveType || !leaveData.startDate || !leaveData.endDate || !leaveData.reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create leave record
    const leave = new Leave(leaveData);
    
    // Check for overlapping leaves
    const hasOverlap = await leave.hasOverlap();
    if (hasOverlap) {
      return res.status(400).json({ error: 'Leave request overlaps with existing leave' });
    }
    
    await leave.save();
    res.status(201).json(leave);
  } catch (error) {
    console.error('Error creating leave:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update leave status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    leave.status = status;
    if (approvedBy) {
      leave.approvedBy = approvedBy;
      leave.approvedAt = new Date();
    }
    
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a leave request
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findByIdAndDelete(id);
    
    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }
    
    res.json({ message: 'Leave deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leave statistics
router.get('/stats/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { startDate, endDate } = req.query;
    
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = {
        startDate: { $gte: new Date(startDate) },
        endDate: { $lte: new Date(endDate) }
      };
    }
    
    const stats = await Leave.aggregate([
      {
        $match: {
          channelId,
          ...dateQuery
        }
      },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: {
            $sum: {
              $ceil: {
                $divide: [
                  { $subtract: ['$endDate', '$startDate'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      }
    ]);
    
    const totalLeaves = await Leave.countDocuments({ channelId, ...dateQuery });
    const pendingLeaves = await Leave.countDocuments({ channelId, status: 'pending', ...dateQuery });
    const approvedLeaves = await Leave.countDocuments({ channelId, status: 'approved', ...dateQuery });
    
    res.json({
      stats,
      summary: {
        total: totalLeaves,
        pending: pendingLeaves,
        approved: approvedLeaves
      }
    });
  } catch (error) {
    console.error('Error fetching leave stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 