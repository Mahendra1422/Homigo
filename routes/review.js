const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { validateReview, isLoggedIn, isReviewAuthor } = require("../middleware.js");


const reviewController = require("../controllers/reviews.js");


//Common part
// /listings/:id/reviews

//Reviews - Post Route route
router.post( "/", validateReview, isLoggedIn ,wrapAsync(reviewController.createReview ));


// Reviews - Delete Route
router.delete( "/:reviewId", isLoggedIn , isReviewAuthor ,  wrapAsync(reviewController.deleteReview ));

module.exports = router;
