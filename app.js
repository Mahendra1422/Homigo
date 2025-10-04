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
const DB_URL = process.env.ATLASDB_URL || LOCAL_DB_URL;

async function connectDB() {
    try {
        console.log("🔄 Attempting to connect to database...");
        console.log("Database URL:", DB_URL.includes("mongodb+srv") ? "🌐 Atlas" : "💻 Local");

        await mongoose.connect(DB_URL, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 1,
        });

        console.log("✅ Database connected successfully!");

        mongoose.connection.on("error", (err) => {
            console.error("❌ MongoDB connection error:", err);
        });

        mongoose.connection.on("disconnected", () => {
            console.log("⚠️ MongoDB disconnected");
        });

        mongoose.connection.on("reconnected", () => {
            console.log("✅ MongoDB reconnected");
        });

    } catch (err) {
        console.error("❌ Database connection error:", err.message);
    }
}
connectDB();

// ============================================================================
// ----------------------------- Session Setup --------------------------------
const store = MongoStore.create({
    mongoUrl: DB_URL,
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
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// Catch-all Route for 404
app.all("*", (req, res, next) => {
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
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server is listening on port ${port}`);
});
