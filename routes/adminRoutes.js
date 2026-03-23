const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const User = require('../models/User');
const QuoteRequest = require('../models/QuoteRequest');
const Contact = require('../models/Contact');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
// Keep only essential routes
router.get('/forgot-password', (req, res) => {
    res.render('admin/forgot-password');
});

router.post('/verify-username', async (req, res) => {
    try {
        const { username } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin) {
            return res.status(404).json({ error: 'Username not found' });
        }
        
        res.json({ message: 'Username verified' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/verify-recovery', async (req, res) => {
    try {
        const { username, recoveryCode } = req.body;
        const admin = await Admin.findOne({ username });
        
        if (!admin || admin.recoveryCode !== recoveryCode) {
            return res.status(400).json({ error: 'Invalid recovery code' });
        }
        
        res.json({ 
            message: 'Recovery successful',
            password: 'LIC@admin2024'  // Return the actual password instead of hash
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
// Add this new route for the dashboard
// In the dashboard route
router.get('/dashboard', async (req, res) => {
    try {
        // Fetch both quotes and contacts
        const quotes = await QuoteRequest.find().sort({ _id: -1 }).limit(5);
        const contacts = await Contact.find().sort({ _id: -1 }).limit(5);

        // Combine and sort by date
        const recentActivities = [...quotes, ...contacts]
            .sort((a, b) => b._id.getTimestamp() - a._id.getTimestamp())
            .slice(0, 5);

        res.render('admin/dashboard', {
            title: 'Dashboard',
            path: '/admin/dashboard',
            recentActivities,
            layout: false
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});
// Add this new route for fetching dashboard data
router.get('/dashboard-data', async (req, res) => {
    try {
        // Get counts
        const quoteCount = await QuoteRequest.countDocuments();
        const messageCount = await Contact.countDocuments();

        // Get recent activity (last 10 items)
        const recentQuotes = await QuoteRequest.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email createdAt');

        const recentMessages = await Contact.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email createdAt');

        // Combine and sort activities
        const recentActivity = [...recentQuotes.map(q => ({
            ...q.toObject(),
            type: 'quote'
        })), ...recentMessages.map(m => ({
            ...m.toObject(),
            type: 'message'
        }))].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

        res.json({
            quoteCount,
            messageCount,
            recentActivity
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Error fetching dashboard data' });
    }
});
// Add these new routes for quotes
router.get('/quotes', (req, res) => {
    res.render('admin/admin-quotes', { layout: false });  // Changed from 'admin/quotes' to 'admin/admin-quotes'
});
// Add delete quote route
router.delete('/delete-quote/:id', async (req, res) => {
    try {
        const quoteId = req.params.id;
        console.log('Attempting to delete quote:', quoteId); // For debugging
        
        const result = await QuoteRequest.findByIdAndDelete(quoteId);
        
        if (!result) {
            console.log('Quote not found'); // For debugging
            return res.status(404).json({ error: 'Quote not found' });
        }
        
        console.log('Quote deleted successfully'); // For debugging
        res.status(200).json({ message: 'Quote deleted successfully' });
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ error: 'Error deleting quote: ' + error.message });
    }
});
router.get('/quotes-data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Items per page
        const search = req.query.search || '';
        const sort = req.query.sort || 'newest';

        // Build search query
        const searchQuery = search ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } }
            ]
        } : {};

        // Get total count for pagination
        const total = await QuoteRequest.countDocuments(searchQuery);
        const totalPages = Math.ceil(total / limit);

        // Get quotes with pagination and sorting
        const quotes = await QuoteRequest.find(searchQuery)
            .sort({ createdAt: sort === 'newest' ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            quotes,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ error: 'Error fetching quotes' });
    }
});
// Add this new route for fetching recent activities
router.get('/recent-activities', async (req, res) => {
    try {
        const quotes = await QuoteRequest.find().sort({ _id: -1 }).limit(5);
        const contacts = await Contact.find().sort({ _id: -1 }).limit(5);

        const recentActivities = [...quotes, ...contacts]
            .sort((a, b) => b._id.getTimestamp() - a._id.getTimestamp())
            .slice(0, 5);

        res.json({ activities: recentActivities });
    } catch (error) {
        console.error('Error fetching recent activities:', error);
        res.status(500).json({ error: 'Error fetching recent activities' });
    }
});
// Add login route with proper CAPTCHA validation
router.post('/login', async (req, res) => {
    try {
        const { username, password, captcha } = req.body;
        
        // First verify CAPTCHA
        if (captcha !== req.session.captcha) {
            return res.status(400).json({ error: 'Invalid CAPTCHA' });
        }

        const admin = await Admin.findOne({ username }).select('+password');
        
        if (!admin) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Direct comparison for initial password
        if (password === 'LIC@admin2024') {
            req.session.isAuthenticated = true;
            return res.json({ message: 'Login successful' });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        req.session.isAuthenticated = true;
        res.json({ message: 'Login successful' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add logout route
router.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.redirect('/admin/dashboard');
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.redirect('/admin/login');
        });
    } else {
        res.redirect('/admin/login');
    }
});

// Add analytics route
router.get('/analytics', async (req, res) => {
    try {
        res.render('admin/analytics-dashboard', {
            title: 'Analytics',
            path: '/admin/analytics',
            layout: false
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).send('Error loading analytics');
    }
});

// Add dashboard analytics data endpoint
router.get('/dashboard-analytics', async (req, res) => {
    try {
        // Get real visitor data from the last 30 days
        const today = new Date();
        const dayAgo = new Date(today - 24*60*60*1000);
        const weekAgo = new Date(today - 7*24*60*60*1000);
        const monthAgo = new Date(today - 30*24*60*60*1000);

        // Get real visitor counts from QuoteRequests and Contacts
        const dailyVisitors = await Promise.all([
            QuoteRequest.countDocuments({ createdAt: { $gte: dayAgo } }),
            Contact.countDocuments({ createdAt: { $gte: dayAgo } })
        ]).then(counts => counts.reduce((a, b) => a + b, 0));

        const weeklyVisitors = await Promise.all([
            QuoteRequest.countDocuments({ createdAt: { $gte: weekAgo } }),
            Contact.countDocuments({ createdAt: { $gte: weekAgo } })
        ]).then(counts => counts.reduce((a, b) => a + b, 0));

        const monthlyVisitors = await Promise.all([
            QuoteRequest.countDocuments({ createdAt: { $gte: monthAgo } }),
            Contact.countDocuments({ createdAt: { $gte: monthAgo } })
        ]).then(counts => counts.reduce((a, b) => a + b, 0));

        // Calculate real conversion rate
        const totalVisitors = monthlyVisitors;
        const totalQuotes = await QuoteRequest.countDocuments();
        const conversionRate = totalVisitors > 0 ? ((totalQuotes / totalVisitors) * 100).toFixed(2) : 0;

        // Get real geographic distribution
        const geography = await QuoteRequest.aggregate([
            {
                $group: {
                    _id: "$city",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Calculate real quick stats
        const todayQuotes = await QuoteRequest.countDocuments({ createdAt: { $gte: dayAgo } });
        const weekQuotes = await QuoteRequest.countDocuments({ createdAt: { $gte: weekAgo } });
        const monthQuotes = await QuoteRequest.countDocuments({ createdAt: { $gte: monthAgo } });

        // Calculate estimated revenue (assuming average policy value)
        const avgPolicyValue = 25000; // Average policy value in INR
        const quickStats = {
            todayPolicies: todayQuotes,
            weekPolicies: weekQuotes,
            monthPolicies: monthQuotes,
            todayRevenue: todayQuotes * avgPolicyValue,
            weekRevenue: weekQuotes * avgPolicyValue,
            monthRevenue: monthQuotes * avgPolicyValue
        };

        // Get real policy distribution from quotes
        const policyTypes = await QuoteRequest.aggregate([
            {
                $group: {
                    _id: "$policyType",
                    count: { $sum: 1 }
                }
            }
        ]);

        const policyDistribution = [
            policyTypes.find(p => p._id === 'Term Life')?.count || 0,
            policyTypes.find(p => p._id === 'Endowment')?.count || 0,
            policyTypes.find(p => p._id === 'ULIP')?.count || 0,
            policyTypes.find(p => p._id === 'Pension')?.count || 0,
            policyTypes.find(p => p._id === 'Health')?.count || 0
        ];

        // Get real age distribution
        const ageGroups = await QuoteRequest.aggregate([
            {
                $bucket: {
                    groupBy: "$age",
                    boundaries: [18, 31, 46, 61, 100],
                    default: "Other",
                    output: {
                        count: { $sum: 1 }
                    }
                }
            }
        ]).then(result => result.map(group => group.count));

        // Calculate real premium trends
        const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        const premiumTrends = await QuoteRequest.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    totalPremium: { $sum: "$estimatedPremium" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const lastSixMonths = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return months[d.getMonth()];
        }).reverse();

        res.json({
            visitors: {
                daily: dailyVisitors,
                weekly: weeklyVisitors,
                monthly: monthlyVisitors
            },
            conversion: {
                rate: parseFloat(conversionRate),
                total: totalQuotes
            },
            geography,
            income: quickStats.monthRevenue,
            quickStats,
            policyDistribution,
            ageGroups,
            premiumTrends: {
                months: lastSixMonths,
                premiumAmount: premiumTrends.map(t => t.totalPremium || 0)
            }
        });
    } catch (error) {
        console.error('Analytics data error:', error);
        res.status(500).json({ error: 'Error fetching analytics data' });
    }
});
// Add these routes for payment management
router.get('/payments', async (req, res) => {
    try {
        res.render('admin/payments-dashboard', {
            title: 'Payments Dashboard',
            path: '/admin/payments',
            layout: false
        });
    } catch (error) {
        console.error('Payments dashboard error:', error);
        res.status(500).send('Error loading payments dashboard');
    }
});

router.get('/payments-data', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get payments with client information
        const payments = await Payment.find()
            .populate('quoteId')
            .sort({ paidAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get summary data
        const totalPayments = await Payment.countDocuments();
        const successfulPayments = await Payment.countDocuments({ status: 'SUCCESS' });
        const pendingPayments = await Payment.countDocuments({ status: 'PENDING' });
        const totalRevenue = await Payment.aggregate([
            { $match: { status: 'SUCCESS' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            payments: payments,
            totalPages: Math.ceil(totalPayments / limit),
            summary: {
                totalRevenue: totalRevenue[0]?.total || 0,
                successfulPayments,
                pendingPayments
            }
        });
    } catch (error) {
        console.error('Error fetching payments data:', error);
        res.status(500).json({ error: 'Error fetching payments data' });
    }
});
// Generate and download receipt
router.get('/generate-receipt/:paymentId', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId)
            .populate('quoteId');
            
        if (!payment) {
            return res.status(404).send('Receipt not found');
        }
        res.render('templates/receipt', { payment });
    } catch (error) {
        console.error('Error generating receipt:', error);
        res.status(500).json({ error: 'Error generating receipt' });
    }
});
// Add payment verification and processing routes
router.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, quoteId } = req.body;
        // Verify payment signature
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
        const generated_signature = hmac.digest('hex');

        if (generated_signature === razorpay_signature) {
            // Update payment status
            await Payment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { 
                    status: 'SUCCESS',
                    transactionId: razorpay_payment_id,
                    paidAt: new Date()
                }
            );
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Invalid payment verification' });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Error verifying payment' });
    }
});
// Add payment status check route
// Fix the incomplete payment status check route
router.get('/payment-status/:quoteId', async (req, res) => {
    try {
        const payment = await Payment.findOne({ quoteId: req.params.quoteId })
            .sort({ createdAt: -1 });
            
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json({
            status: payment.status,
            paymentId: payment._id,
            amount: payment.amount,
            paidAt: payment.paidAt
        });
    } catch (error) {
        console.error('Error checking payment status:', error);
        res.status(500).json({ error: 'Error checking payment status' });
    }
});
// Client management routes remain unchanged...
// Export the router
module.exports = router;