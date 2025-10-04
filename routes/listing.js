const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const multer = require("multer");
const {storage}= require("../cloudconfig.js");
const upload = multer({ storage });




const listingController = require("../controllers/listings.js");

// Index and Create Route
router.route("/")
    .get( wrapAsync(listingController.index))
    .post( isLoggedIn,
        validateListing,
        upload.single('listing[image]'),
        wrapAsync(listingController.createListing));

// Address autocomplete API route (MUST be before /:id routes)
router.get("/api/address-suggestions", isLoggedIn, wrapAsync(listingController.getAddressSuggestions));

// NEW Route
router.get( "/new", isLoggedIn, listingController.renderNewForm );

// Show Update and Delete Routes 
router.route("/:id")
    .get( wrapAsync(listingController.showListings))
    .put( isLoggedIn, isOwner, validateListing, upload.single('listing[image]'), wrapAsync(listingController.updateListing))
    .delete( isLoggedIn, isOwner, wrapAsync(listingController.deleteListing));

// Edit Route
router.get( "/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editlisting));

module.exports = router;
