const mongoose = require('mongoose');
const Leave = require('./models/Leave');
require('dotenv').config();

async function testDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test creating a leave record
    const testLeave = new Leave({
      userId: 'U1234567890',
      userName: 'Test User',
      userEmail: 'test@example.com',
      leaveType: 'vacation',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-17'),
      startTime: '09:00',
      endTime: '17:00',
      isFullDay: true,
      reason: 'Test leave request',
      channelId: 'C1234567890',
      channelName: 'test-channel',
      status: 'pending'
    });

    await testLeave.save();
    console.log('✅ Test leave record created');

    // Test querying today's leaves
    const todaysLeaves = await Leave.getTodaysLeaves('C1234567890');
    console.log('✅ Today\'s leaves query works:', todaysLeaves.length, 'records found');

    // Test overlap detection
    const hasOverlap = await testLeave.hasOverlap();
    console.log('✅ Overlap detection works:', hasOverlap);

    // Clean up test data
    await Leave.deleteOne({ _id: testLeave._id });
    console.log('✅ Test data cleaned up');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDatabase();
}

module.exports = { testDatabase }; 