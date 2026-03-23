const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const verificationController = require('../controllers/verificationController');

// Add verification routes
router.post('/send-verification', verificationController.sendVerificationCode);
router.post('/verify-code', verificationController.verifyCode);
// Rate limiting setup
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { message: 'Too many login attempts. Please try again later.' }
});

// Input validation middleware
const validateRegistration = (req, res, next) => {
    const { name, email, mobile, dob, address, password } = req.body;
    
    if (!name || !email || !mobile || !dob || !address || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
    }

    // Mobile validation (10 digits)
    if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Mobile number must be 10 digits' });
    }

    // Password validation (min 6 chars, at least one letter, number, and special char)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{6,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ 
            message: 'Password must be at least 6 characters and contain letters, numbers, and special characters'
        });
    }

    next();
};

router.post('/register', validateRegistration, async (req, res) => {
    try {
        const { name, email, mobile, dob, address, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email },
                { mobile }
            ]
        });

        if (existingUser) {
            return res.status(400).json({ 
                message: existingUser.email === email ? 'Email already registered' : 'Mobile number already registered'
            });
        }

        // Create new user
        const user = new User({
            name,
            email,
            mobile,
            dob: new Date(dob),
            address,
            password
        });

        await user.save();
        res.status(201).json({ 
            success: true,
            message: 'Registration successful',
            redirectUrl: '/login'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed. Please try again later.'
        });
    }
});

// Password reset request
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Create test account using Ethereal
        const testAccount = await nodemailer.createTestAccount();

        // Create transporter with Ethereal credentials
        const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        const protocol = req.protocol;
        const host = req.get('host');
        const resetUrl = `${protocol}://${host}/reset-password/${resetToken}`;
        const info = await transporter.sendMail({
            from: '"LIC Advisor" <support@licadvisor.com>',
            to: user.email,
            subject: 'Password Reset Request',
            html: `Please click <a href="${resetUrl}">here</a> to reset your password. This link is valid for 1 hour.`
        });

        // Log the test email URL (for development)
        console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));

        res.json({ 
            message: 'Password reset link sent to email',
            previewUrl: nodemailer.getTestMessageUrl(info) // Remove this in production
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Error sending reset email' });
    }
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findOne({
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
});

// Apply rate limiting to login route
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, captcha } = req.body;
        
        if (!email || !password || !captcha) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Verify captcha
        if (!verifyCaptcha(captcha)) {
            return res.status(400).json({ message: 'Invalid captcha' });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        req.session.user = {
            id: user._id,
            name: user.name,
            role: user.role,
            email: user.email
        };

        res.json({ 
            success: true,
            message: 'Login successful',
            redirectUrl: user.role === 'admin' ? '/admin/dashboard' : '/customer/dashboard'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Login failed. Please try again later.'
        });
    }
});

// Implement captcha verification
function verifyCaptcha(captchaValue) {
    // Add your captcha verification logic here
    return true; // Placeholder return
}

// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

router.get('/reset-password/:token', (req, res) => {
    res.render('reset-password');
});

module.exports = router;