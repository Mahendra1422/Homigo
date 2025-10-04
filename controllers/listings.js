const Listing = require("../models/listing");
const { createGeocodingService, DEFAULT_COORDINATES } = require("../utils/geocoding.js");

module.exports.index = async (req, res) => {
    const allListings = await Listing.find({});
    res.render("./listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("./listings/new.ejs");
};

module.exports.showListings = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");
    if (!listing) {
        req.flash("error", "Listing You Requested Does Not Exit")
        return res.redirect("/listings");
    }
    
    // Log warning if listing doesn't have an owner
    if (!listing.owner) {
        console.warn(`Warning: Listing ${id} does not have an owner assigned`);
    }
    
    console.log(listing);
    res.render("./listings/show.ejs", { listing , mapToken: process.env.MAP_TOKEN });
};

module.exports.createListing = async (req, res) => {
    try {
        let url = req.file.path;
        let filename = req.file.filename;

        const { location, country } = req.body.listing;
        const newListing = new Listing(req.body.listing);
        newListing.owner = req.user._id;
        newListing.image = { url, filename };

        // Initialize geocoding service
        const geocodingService = createGeocodingService(process.env.MAP_TOKEN);
        
        // Try to geocode the address
        const geocodeResult = await geocodingService.geocodeAddress(location);
        
        if (geocodeResult.success) {
            newListing.geometry = {
                type: "Point",
                coordinates: geocodeResult.coordinates // [longitude, latitude]
            };
            
            // Update location with formatted address if available
            if (geocodeResult.address && geocodeResult.address !== location) {
                newListing.location = geocodeResult.address;
            }
            
            // Update country if not provided or if geocoded country is more accurate
            if (!country && geocodeResult.country) {
                newListing.country = geocodeResult.country;
            }
            
            req.flash("success", "New Listing Created with location mapped successfully!");
        } else {
            // Use default coordinates if geocoding fails
            newListing.geometry = {
                type: "Point",
                coordinates: [DEFAULT_COORDINATES.lng, DEFAULT_COORDINATES.lat]
            };
            
            console.warn("Geocoding failed for address:", location, "Error:", geocodeResult.error);
            req.flash("warning", `Listing created but location mapping failed: ${geocodeResult.error}. Please update the address for accurate location display.`);
        }

        await newListing.save();
        res.redirect("/listings");
    } catch (error) {
        console.error("Error creating listing:", error);
        req.flash("error", "Failed to create listing. Please try again.");
        res.redirect("/listings/new");
    }
};

module.exports.editlisting = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing You Requested Does Not Exit")
        return res.redirect("/listings");
    }
    let originalImageUrl = listing.image && listing.image.url ? listing.image.url : listing.image;
    if (originalImageUrl && originalImageUrl.includes("/upload")) {
        originalImageUrl = originalImageUrl.replace("/upload", "/upload/e_blur:200,h_300,w_250");
    }
    res.render("./listings/edit.ejs", { listing, originalImageUrl });
};


module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    
    try {
        let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { new: true });

        if (!listing) {
            req.flash("error", "Listing not found");
            return res.redirect("/listings");
        }

        // If location updated, fetch new coordinates
        if (req.body.listing.location) {
            const geocodingService = createGeocodingService(process.env.MAP_TOKEN);
            const geocodeResult = await geocodingService.geocodeAddress(req.body.listing.location);
            
            if (geocodeResult.success) {
                listing.geometry = {
                    type: "Point",
                    coordinates: geocodeResult.coordinates
                };
                
                // Update with formatted address if different
                if (geocodeResult.address && geocodeResult.address !== req.body.listing.location) {
                    listing.location = geocodeResult.address;
                }
                
                // Update country if geocoded country is available and current country is empty
                if (!listing.country && geocodeResult.country) {
                    listing.country = geocodeResult.country;
                }
                
                console.log("Location updated successfully for listing:", id);
            } else {
                console.warn("Geocoding update failed for listing:", id, "Error:", geocodeResult.error);
                req.flash("warning", `Listing updated but location mapping failed: ${geocodeResult.error}`);
                
                // Keep existing geometry if geocoding fails and don't create invalid geometry
                if (!listing.geometry || !listing.geometry.coordinates) {
                    listing.geometry = {
                        type: "Point",
                        coordinates: [DEFAULT_COORDINATES.lng, DEFAULT_COORDINATES.lat]
                    };
                }
            }
        }

        // Handle image update
        if (typeof req.file !== "undefined") {
            let url = req.file.path;
            let filename = req.file.filename;
            listing.image = { url, filename };
        }

        await listing.save();
        req.flash("success", "Listing Updated Successfully!");
        res.redirect(`/listings/${id}`);
    } catch (error) {
        console.error("Error updating listing:", error);
        req.flash("error", "Failed to update listing. Please try again.");
        res.redirect(`/listings/${id}/edit`);
    }
};


module.exports.deleteListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Listing Deleted Successfully..!")
    res.redirect("/listings");
};

// Address autocomplete API endpoint
module.exports.getAddressSuggestions = async (req, res) => {
    try {
        const { query, country } = req.query;
        
        // Validate input parameters
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                suggestions: [],
                error: "Query parameter is required and must be a string"
            });
        }
        
        if (query.length < 2) {
            return res.status(400).json({
                success: false,
                suggestions: [],
                error: "Query must be at least 2 characters long"
            });
        }
        
        if (query.length > 200) {
            return res.status(400).json({
                success: false,
                suggestions: [],
                error: "Query is too long"
            });
        }
        
        // Validate API token
        if (!process.env.MAP_TOKEN) {
            console.error("MAP_TOKEN not configured");
            return res.status(500).json({
                success: false,
                suggestions: [],
                error: "Geocoding service not available"
            });
        }

        const geocodingService = createGeocodingService(process.env.MAP_TOKEN);
        const options = {
            limit: 5,
            ...(country && typeof country === 'string' && country.length > 0 && { country: country.toLowerCase() })
        };
        
        const result = await geocodingService.getAutocompleteSuggestions(query.trim(), options);
        
        // Ensure result has proper structure
        if (result && typeof result === 'object') {
            res.json({
                success: result.success || false,
                suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
                error: result.error || null
            });
        } else {
            throw new Error("Invalid response from geocoding service");
        }
    } catch (error) {
        console.error("Address autocomplete error:", error);
        res.status(500).json({
            success: false,
            suggestions: [],
            error: "Failed to get address suggestions"
        });
    }
};

