const mongoose = require('mongoose');
const Listing = require('../models/listing.js');

// Connect to your MongoDB database
// Replace the connection string with your actual MongoDB connection string
const MONGO_URL = process.env.ATLAS_DB_URL || 'mongodb://127.0.0.1:27017/airbnb';

async function checkListingsIntegrity() {
    try {
        await mongoose.connect(MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Find all listings
        const allListings = await Listing.find({});
        console.log(`Total listings in database: ${allListings.length}`);
        
        // Check for listings without owner
        const listingsWithoutOwner = await Listing.find({ 
            $or: [
                { owner: null }, 
                { owner: { $exists: false } }
            ]
        });
        
        console.log(`Listings without owner: ${listingsWithoutOwner.length}`);
        
        if (listingsWithoutOwner.length > 0) {
            console.log('Listings without owner:');
            listingsWithoutOwner.forEach(listing => {
                console.log(`- ID: ${listing._id}, Title: ${listing.title}`);
            });
        }
        
        // Check for listings with invalid owner references
        const listingsWithOwner = await Listing.find({ 
            owner: { $exists: true, $ne: null }
        }).populate('owner');
        
        const listingsWithInvalidOwner = listingsWithOwner.filter(listing => !listing.owner);
        
        console.log(`Listings with invalid owner references: ${listingsWithInvalidOwner.length}`);
        
        if (listingsWithInvalidOwner.length > 0) {
            console.log('Listings with invalid owner references:');
            listingsWithInvalidOwner.forEach(listing => {
                console.log(`- ID: ${listing._id}, Title: ${listing.title}`);
            });
        }
        
    } catch (error) {
        console.error('Error checking listings integrity:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

checkListingsIntegrity();