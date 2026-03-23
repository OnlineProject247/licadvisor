const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');

// Get settings page
router.get('/', async (req, res) => {
    try {
        const admin = await Admin.findOne({});
        res.render('admin/settings', {
            layout: false,
            path: '/admin/settings',
            admin: admin
        });
    } catch (error) {
        res.status(500).send('Error loading settings');
    }
});

// Update recovery code with verification
router.post('/update-recovery', async (req, res) => {
    try {
        const { currentPassword, newRecoveryCode } = req.body;
        const admin = await Admin.findOne({}).select('+password'); // Explicitly select password field

        if (!admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Direct password comparison for initial password
        if (currentPassword === 'LIC@admin2024') {  // Use your actual initial password
            admin.recoveryCode = newRecoveryCode;
            await admin.save();
            return res.json({ message: 'Recovery code updated successfully' });
        }

        // Verify current password using bcrypt
        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Only update if password matches
        admin.recoveryCode = newRecoveryCode;
        await admin.save();
        
        console.log('Recovery code updated to:', admin.recoveryCode);
        res.json({ message: 'Recovery code updated successfully' });
        
    } catch (error) {
        console.error('Recovery code update error:', error);
        res.status(500).json({ error: 'Error updating recovery code' });
    }
});

// Add verification route
router.get('/verify-recovery', async (req, res) => {
    try {
        const admin = await Admin.findOne({});
        res.json({ 
            recoveryCode: admin.recoveryCode,
            hasRecoveryCode: !!admin.recoveryCode
        });
    } catch (error) {
        res.status(500).json({ error: 'Error verifying recovery code' });
    }
});
module.exports = router;