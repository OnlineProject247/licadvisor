const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('Connected to MongoDB Atlas');
    } catch (err) {
        console.error('MongoDB Atlas connection failed:', err.message);
        console.log('Falling back to local MongoDB...');
        try {
            await mongoose.connect('mongodb://localhost:27017/lic_advisor');
            console.log('Connected to local MongoDB');
        } catch (localErr) {
            console.error('Local MongoDB connection error:', localErr);
        }
    }
};
connectDB();

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));

// Error handling
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// For Vercel
module.exports = app;