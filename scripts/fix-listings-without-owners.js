const mongoose = require('mongoose');
const Listing = require('../models/listing.js');
const User = require('../models/user.js');

// Connect to your MongoDB database
const MONGO_URL = process.env.ATLAS_DB_URL || 'mongodb://127.0.0.1:27017/airbnb';

async function fixListingsWithoutOwners() {
    try {
        await mongoose.connect(MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Find listings without owner
        const listingsWithoutOwner = await Listing.find({ 
            $or: [
                { owner: null }, 
                { owner: { $exists: false } }
            ]
        });
        
        console.log(`Found ${listingsWithoutOwner.length} listings without owner`);
        
        if (listingsWithoutOwner.length === 0) {
            console.log('No listings without owners found. Nothing to fix.');
            return;
        }
        
        // Find the first available user to assign as owner
        const firstUser = await User.findOne({});
        
        if (!firstUser) {
            console.log('No users found in the database. Cannot assign owners to listings.');
            console.log('Please create at least one user first.');
            return;
        }
        
        console.log(`Assigning listings to user: ${firstUser.username} (${firstUser._id})`);
        
        // Update all listings without owner
        const updateResult = await Listing.updateMany(
            { 
                $or: [
                    { owner: null }, 
                    { owner: { $exists: false } }
                ]
            },
            { owner: firstUser._id }
        );
        
        console.log(`Updated ${updateResult.modifiedCount} listings`);
        console.log('All listings now have owners assigned.');
        
    } catch (error) {
        console.error('Error fixing listings without owners:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Only run if this script is executed directly
if (require.main === module) {
    fixListingsWithoutOwners();
}

module.exports = fixListingsWithoutOwners;