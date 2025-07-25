const mongoose = require('mongoose');
require('dotenv').config();

async function migrateIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get the Leave collection
    const Leave = mongoose.model('Leave');
    const collection = Leave.collection;

    // List all indexes
    const indexes = await collection.indexes();
    console.log('🔍 Current indexes:', indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    // Find and drop the old unique index (without leaveType)
    const oldIndexName = 'userId_1_startDate_1_endDate_1_channelId_1';
    const hasOldIndex = indexes.some(idx => idx.name === oldIndexName);
    
    if (hasOldIndex) {
      console.log('🗑️ Dropping old unique index:', oldIndexName);
      await collection.dropIndex(oldIndexName);
      console.log('✅ Old index dropped successfully');
    } else {
      console.log('ℹ️ Old index not found, skipping drop');
    }

    // Ensure the new index is created
    console.log('🔧 Creating new unique index with leaveType...');
    await Leave.createIndexes();
    console.log('✅ New indexes created successfully');

    // Verify the new index
    const newIndexes = await collection.indexes();
    console.log('🔍 Updated indexes:', newIndexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique
    })));

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateIndexes();
}

module.exports = { migrateIndexes }; 