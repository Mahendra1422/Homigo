// ============================================================================
// ----------------------------- Load Environment -----------------------------
const path = require("path");
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// ============================================================================
// ----------------------------- Imports --------------------------------------
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const ExpressError = require("./utils/ExpressError.js");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// ============================================================================
// ----------------------------- App Config -----------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

// ============================================================================
// ----------------------------- MongoDB Connection ---------------------------

const LOCAL_DB_URL = "mongodb://127.0.0.1:27017/homigo";
const ATLAS_PRIMARY_URL = process.env.ATLASDB_URL;
const ATLAS_ALT_URL = process.env.ATLASDB_URL_ALT;
// Session store will use the first available URL, falling back to local
const SESSION_DB_URL = ATLAS_PRIMARY_URL || ATLAS_ALT_URL || LOCAL_DB_URL;

async function connectDB() {
    const connectionStrategies = [
        { name: "Atlas Primary", url: ATLAS_PRIMARY_URL, isAtlas: true },
        { name: "Atlas Alternative", url: ATLAS_ALT_URL, isAtlas: true },
        { name: "Local MongoDB", url: LOCAL_DB_URL, isAtlas: false }
    ];

    for (const strategy of connectionStrategies) {
        if (!strategy.url) continue;
        
        try {
            console.log(`🔄 Attempting to connect to ${strategy.name}...`);
            
            const connectionOptions = {
                serverSelectionTimeoutMS: strategy.isAtlas ? 15000 : 5000,
                socketTimeoutMS: strategy.isAtlas ? 30000 : 15000,
                maxPoolSize: 10,
                minPoolSize: 1,
            };
            
            // Add specific options for Atlas alternative connection
            if (strategy.url === ATLAS_ALT_URL) {
                connectionOptions.ssl = true;
                connectionOptions.authSource = 'admin';
            }

            await mongoose.connect(strategy.url, connectionOptions);

            console.log(`✅ Successfully connected to ${strategy.name}!`);

            // Set up connection event listeners
            mongoose.connection.on("error", (err) => {
                console.error("❌ MongoDB connection error:", err.message);
            });

            mongoose.connection.on("disconnected", () => {
                console.log("⚠️ MongoDB disconnected");
            });

            mongoose.connection.on("reconnected", () => {
                console.log("✅ MongoDB reconnected");
            });

            return; // Successfully connected, exit the function

        } catch (err) {
            console.error(`❌ ${strategy.name} connection failed: ${err.message}`);
            
            // Continue to next strategy
            if (strategy === connectionStrategies[connectionStrategies.length - 1]) {
                // This was the last strategy
                console.log("\n🔧 All connection strategies failed. Troubleshooting steps:");
                console.log("1. Check if your IP is whitelisted in MongoDB Atlas");
                console.log("2. Verify your database credentials");
                console.log("3. Check your internet connection");
                console.log("4. Make sure MongoDB is running locally (if using local fallback)");
                console.log("5. Try connecting with a different network");
                
                console.log("\n⚠️ Application will continue without database connection.");
                console.log("💡 Some features may not work properly.");
            }
        }
    }
}
connectDB();

// ============================================================================
// ----------------------------- Session Setup --------------------------------
const store = MongoStore.create({
    mongoUrl: SESSION_DB_URL,
    crypto: { secret: process.env.SECRET || "thisshouldbeabettersecret" },
    touchAfter: 24 * 3600 // 24 hours
});

store.on("error", (err) => {
    console.error("❌ Session Store Error:", err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET || "thisshouldbeabettersecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 3, // 3 days
        maxAge: 1000 * 60 * 60 * 24 * 3
    }
};

app.use(session(sessionOptions));
app.use(flash());

// ============================================================================
// ----------------------------- Passport Setup -------------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ============================================================================
// ----------------------------- Flash & Current User -------------------------
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// ============================================================================
// ----------------------------- Routes ---------------------------------------
app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Demo User Route
app.get("/demouser", async (req, res) => {
    try {
        const fakeUser = new User({
            email: "student@gmail.com",
            username: "delta-student",
        });
        const registeredUser = await User.register(fakeUser, "helloworld");
        res.send(registeredUser);
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("/");
    }
});

// Main Routers
app.use("/", userRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);

// Catch-all Route for 404 (Express 5 compatible)
app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found...!!!😓"));
});

// Error Handler
app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = "Something went wrong!";
    res.status(statusCode).render("error.ejs", { err });
});

// ============================================================================
// ----------------------------- Start Server ---------------------------------
// Use PORT from environment (Render sets this automatically)
// Fallback to 3000 for local development
const port = process.env.PORT || 3000;

// Render requires binding to 0.0.0.0, localhost for local dev
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.listen(port, host, () => {
    console.log(`🚀 Server is listening on ${host}:${port}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});
