const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const AdminLoginAttempt = require('../models/AdminLoginAttempt');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const ipAddress = req.ip;

    try {
        // Add debugging to see what's being received
        console.log('Login attempt:', { username, passwordLength: password?.length, ipAddress });
        
        let loginAttempt = await AdminLoginAttempt.findOne({ username });
        
        // Check for locked account
        if (loginAttempt && loginAttempt.lockedUntil && loginAttempt.lockedUntil > new Date()) {
            const timeLeftMs = loginAttempt.lockedUntil - new Date();
            const minutes = Math.floor(timeLeftMs / (1000 * 60));
            const seconds = Math.ceil((timeLeftMs % (1000 * 60)) / 1000);
            const timeMessage = minutes > 0 
                ? `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} seconds`
                : `${seconds} seconds`;
            
            return res.status(403).json({
                error: `Admin account temporarily locked. Please try again after ${timeMessage}.`
            });
        }

        // Validate credentials against admin collection
        const admin = await mongoose.connection.db.collection('admins').findOne({ username });
        console.log('Admin found:', admin ? 'Yes' : 'No');
        
        const isValidCredentials = admin && await bcrypt.compare(password, admin.password);
        console.log('Password valid:', isValidCredentials ? 'Yes' : 'No');

        if (!isValidCredentials) {
            if (!loginAttempt) {
                loginAttempt = new AdminLoginAttempt({
                    username,
                    attempts: 1,
                    ipAddress
                });
            } else {
                loginAttempt.attempts += 1;
                
                if (loginAttempt.attempts >= 3) {
                    loginAttempt.lockedUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
                    await loginAttempt.save();
                    return res.status(403).json({
                        error: 'Too many failed attempts. Account locked for 2 minutes.'
                    });
                }
            }
            await loginAttempt.save();
            return res.status(401).json({
                error: `Invalid admin credentials. ${3 - loginAttempt.attempts} attempts remaining.`
            });
        }

        if (loginAttempt) {
            loginAttempt.attempts = 0;
            loginAttempt.lockedUntil = null;
            await loginAttempt.save();
        }

        // If we get here, login is successful
        console.log('Login successful for:', username);
        res.json({ success: true });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add this middleware FIRST, before any routes
router.use((req, res, next) => {
    console.log('Admin auth route accessed:', {
        method: req.method,
        path: req.path,
        body: req.body
    });
    next();
});

// Now define your routes
router.get('/forgot-password', (req, res) => {
    res.render('admin/forgot-password', { layout: false });
});

router.post('/verify-username', async (req, res) => {
    console.log('Processing verify-username request:', req.body);
    try {
        const { username } = req.body;
        // Use the same query method as in the login route
        const admin = await mongoose.connection.db.collection('admins').findOne({ username });
        
        if (!admin) {
            console.log('Username not found:', username);
            return res.status(404).json({ error: 'Username not found' });
        }
        
        // Add logging to help debug
        console.log('Username verified:', username);
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Username verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify-recovery', async (req, res) => {
    try {
        const { username, recoveryCode } = req.body;
        const admin = await mongoose.connection.db.collection('admins').findOne({ 
            username,
            recoveryCode 
        });

        if (!admin) {
            return res.status(404).json({ error: 'Invalid recovery code' });
        }

        // Return the plaintext password if it exists, otherwise return a message
        if (admin.plaintextPassword) {
            console.log('Recovery successful for:', username);
            res.json({ 
                success: true,
                password: admin.plaintextPassword
            });
        } else {
            // For admins created before this change
            res.json({ 
                success: true,
                password: 'Admin1234@' // Default password
            });
        }
    } catch (error) {
        console.error('Recovery verification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add this after your routes but before module.exports
router.use((err, req, res, next) => {
    console.error('Admin auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Add this test route
router.get('/test', (req, res) => {
    res.json({ message: 'Admin auth routes are working' });
});

// Add this route to create a test admin account
router.get('/setup-admin', async (req, res) => {
    try {
        // First, delete all existing admins using direct collection access
        await mongoose.connection.db.collection('admins').deleteMany({});
        
        const plainPassword = 'Admin1234@';
        // Create new admin directly in the collection
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const newAdmin = {
            username: 'licadvisor',
            password: hashedPassword,
            plaintextPassword: plainPassword, // Store plaintext for recovery
            recoveryCode: 'LIC@admin20111979',
            email: 'admin@licadvisor.com',
            createdAt: new Date()
        };
        
        // Insert directly into collection
        const result = await mongoose.connection.db.collection('admins').insertOne(newAdmin);
        
        console.log('Admin created directly in collection:', {
            username: newAdmin.username,
            id: result.insertedId
        });
        
        return res.json({ 
            message: 'Admin account created successfully',
            admin: { 
                username: newAdmin.username,
                id: result.insertedId
            }
        });
    } catch (error) {
        console.error('Error setting up admin:', error);
        return res.status(500).json({ error: 'Failed to setup admin account', details: error.message });
    }
});
module.exports = router;