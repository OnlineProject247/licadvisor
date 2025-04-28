require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const contactRoutes = require('./routes/contact');
const QuoteRequest = require('./models/QuoteRequest');
const expressLayouts = require('express-ejs-layouts');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminMessagesRouter = require('./routes/adminMessages');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const session = require('express-session');
const flash = require('connect-flash');
const customerRoutes = require('./routes/customerRoutes');
const appointmentRouter = require('./routes/appointment');
// Add this with your other require statements at the top
const newsletterRoutes = require('./routes/newsletterRoutes');
const generateSitemap = require('./utils/sitemapGenerator');

// Initialize express
const app = express();

// View engine and middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Add session before routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'licadvisor2024secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
app.use(flash());
// Make sure these lines appear BEFORE any catch-all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep only one session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'licadvisor2024secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(flash());

// Remove all other instances of these routes and keep only these
app.use('/admin', adminAuthRoutes);  // Auth routes first
app.use('/admin/contacts', adminMessagesRouter);
app.use('/admin/settings', adminSettingsRoutes);
app.use('/admin', adminRoutes);  // General admin routes last

// Update the appointment route with error handling
app.use('/appointment', (req, res, next) => {
    console.log('Appointment request received:', req.body); // Add logging
    next();
}, appointmentRouter);
app.use(express.static('public'));

// Then add your routes
app.use('/customer', customerRoutes);
app.use('/admin', adminAuthRoutes);
// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
// Add calculator route
app.get('/calculator', (req, res) => {
    res.render('calculator/premium-calculator');
});
// Add these routes with your other routes
app.get('/raise-quote', (req, res) => {
    res.render('quotes/quote-request');
});
// Add this with your other routes
// Update the submit-quote route
app.post('/submit-quote', async (req, res) => {
    try {
        const quoteRequest = new QuoteRequest({
            name: req.body.name,
            mobile: req.body.mobile,
            email: req.body.email,
            city: req.body.city,
            planInterest: req.body.planInterest,
            message: req.body.message
        });

        await quoteRequest.save();
        console.log('New quote request saved:', quoteRequest);
        res.status(200).json({ message: 'Quote request received' });
    } catch (error) {
        console.error('Error saving quote request:', error);
        res.status(500).json({ error: 'Failed to process quote request' });
    }
});
app.get('/thank-you', (req, res) => {
    res.render('quotes/thank-you');
});
app.get('/calculator/results', (req, res) => {
    res.render('calculator/premium-results');
});
// MongoDB Connection
// Add this before your routes
// Update MongoDB Connection (find the mongoose.connect section)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lic_advisor', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));
// Add after your existing routes
// Replace this route
app.get('/admin/admin-login', (req, res) => {
    res.render('admin/admin-login', { layout: false });
});

// With this route
app.get('/admin/login', (req, res) => {
    res.render('admin/admin-login', { layout: false });
});
app.get('/', (req, res) => {
    res.render('index');
});
// Add this route
// Insurance Plans Routes
app.get('/policies/insurance', (req, res) => {
    res.render('policies/insurance/insurance-plans');
});
app.get('/policies/insurance/riders', (req, res) => {
    res.render('policies/insurance/riders');
});
app.get('/policies/insurance/endowment', (req, res) => {
    res.render('policies/insurance/endowment', {
        title: 'Endowment Insurance Plans',
        metaDescription: 'Secure your future with LIC endowment plans. Get guaranteed returns and life coverage. Expert advice on choosing the best endowment policy for your needs.',
        keywords: 'LIC endowment plans, endowment policy, life insurance with returns, savings with insurance'
    });
});

app.get('/policies/insurance/term-assurance', (req, res) => {
    res.render('policies/insurance/term-assurance', {
        title: 'Term Insurance Plans',
        metaDescription: 'Protect your family with LIC term insurance plans. Get high coverage at affordable premiums. Compare term plans and secure your family\'s future.',
        keywords: 'LIC term insurance, term plans, life coverage, family protection, affordable insurance'
    });
});
app.get('/policies', (req, res) => {
    res.render('policies/overview', {
        title: 'Insurance Policies',
        metaDescription: 'Explore LIC insurance policies including endowment, term, pension, and unit-linked plans. Find the best insurance solution for your needs with our expert guidance.',
        keywords: 'LIC policies, insurance plans, endowment plans, term insurance, pension plans, unit linked insurance'
    });
});
// Policy routes
app.get('/policies/insurance/endowment', (req, res) => {
    res.render('policies/insurance/endowment');
});
// Add this route
app.get('/policies/insurance/money-back', (req, res) => {
    res.render('policies/insurance/money-back');
});
app.get('/policies/pension', (req, res) => {
    res.render('policies/pension/pension-plans');
});
app.get('/policies/unit-linked', (req, res) => {
    res.render('policies/unit-linked/unit-linked-plans');
});
// Whole Life Plans Route
app.get('/policies/insurance/whole-life', (req, res) => {
    res.render('policies/insurance/whole-life');
});
app.get('/policies/micro-insurance', (req, res) => {
    res.render('policies/micro-insurance/micro-insurance-plans');
});
app.get('/policies/withdrawn', (req, res) => {
    res.render('policies/withdrawn/withdrawn-plans');
});
app.use('/admin', adminRoutes);
// Add about route
app.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
});

// Add this route before mounting the contact routes
app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Us' });
});

// Mount the contact routes (keep this existing line)
app.use('/contact', contactRoutes);
// Admin routes
app.use('/admin', adminRoutes);
app.use('/admin/contacts', adminMessagesRouter);

// Update the adminMessages router mounting to include layout: false
app.use('/admin/contacts', (req, res, next) => {
    res.locals.layout = false;
    next();
}, adminMessagesRouter);

// Add this line with your other route configurations
app.use('/admin/settings', adminSettingsRoutes);
// Replace this route
// Update the plan route with proper naming
// Update this route to match the new file name
// Update the route to use the default layout
app.get('/policies/insurance/endowment/717', (req, res) => {
    res.render('policies/insurance/endowment/LIC-Single-Premium-Endowment-Plan-717', {
        title: "LIC's Single Premium Endowment Plan 717"
    });
});

// Add route for Plan 714
app.get('/policies/insurance/endowment/714', (req, res) => {
    res.render('policies/insurance/endowment/LIC-Endowment-Plan-714', {
        title: "LIC's New Endowment Plan 714",
        css: '/css/LIC-Endowment-Plan-714.css'  // Add this line
    });
});
app.get('/policies/insurance/endowment/715', (req, res) => {
    res.render('policies/insurance/endowment/LIC-New-Jeevan-Anand-Plan-715', {
        title: "LIC's New Jeevan Anand Plan 715",
        planNo: "715",
        uin: "512N279V03",
        layout: 'layouts/main', // Ensure correct layout is used
        additionalCSS: ['lic-new-jeevan-anand-715', 'schedule-modal'] // Include required CSS files
    });
});
app.use('/appointment', appointmentRouter);
app.use('/newsletter', newsletterRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Add session middleware before your routes
app.use(session({
    secret: 'lic-advisor-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using HTTPS
}));

// Add these before your route configurations
// REMOVE these duplicate session middleware declarations (lines 29-34, 177-182, and 186-192)
// Keep only this one at the top of your routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'licadvisor2024secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(flash());
// Add these routes with your other routes
app.get('/privacy-policy', (req, res) => {
    res.render('policies/legal/privacy-policy', { 
        title: 'Privacy Policy',
        additionalCSS: ['legal']
    });
});

app.get('/terms', (req, res) => {
    res.render('policies/legal/terms', { 
        title: 'Terms & Conditions',
        additionalCSS: ['legal']
    });
});

app.get('/disclaimer', (req, res) => {
    res.render('policies/legal/disclaimer', { 
        title: 'Disclaimer',
        additionalCSS: ['legal']
    });
});

app.get('/cookie-policy', (req, res) => {
    res.render('policies/legal/cookie-policy', { 
        title: 'Cookie Policy',
        additionalCSS: ['legal']
    });
});
// Add these near your other route imports
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

// Add these with your other routes
app.get('/sitemap', (req, res) => {
    res.render('sitemap', {
        title: 'Sitemap',
        additionalCSS: ['sitemap'],
        metaDescription: 'Complete sitemap of LIC Advisor website. Find all pages and resources easily.'
    });
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const hostname = 'http://' + req.get('host');
        
        const links = [
            { url: '/', changefreq: 'daily', priority: 1.0 },
            { url: '/about', changefreq: 'monthly', priority: 0.8 },
            { url: '/contact', changefreq: 'monthly', priority: 0.8 },
            { url: '/calculator', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies', changefreq: 'weekly', priority: 0.9 },
            { url: '/policies/insurance', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/insurance/endowment', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/insurance/whole-life', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/insurance/money-back', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/insurance/term-assurance', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/pension', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/unit-linked', changefreq: 'weekly', priority: 0.8 },
            { url: '/policies/micro-insurance', changefreq: 'weekly', priority: 0.8 },
            { url: '/privacy-policy', changefreq: 'monthly', priority: 0.5 },
            { url: '/terms', changefreq: 'monthly', priority: 0.5 },
            { url: '/disclaimer', changefreq: 'monthly', priority: 0.5 },
            { url: '/cookie-policy', changefreq: 'monthly', priority: 0.5 },
            { url: '/legal', changefreq: 'monthly', priority: 0.5 },
            { url: '/sitemap', changefreq: 'monthly', priority: 0.3 }
        ];

        const stream = new SitemapStream({ hostname });
        const data = await streamToPromise(Readable.from(links).pipe(stream));
        
        res.header('Content-Type', 'application/xml');
        res.send(data.toString());
    } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).end();
    }
});
// Add this with your other policy routes
app.get('/policies/insurance/endowment/774', (req, res) => {
    res.render('policies/insurance/endowment/LIC-Amritbaal-Plan-774', {
        title: "LIC's Amritbaal Plan 774",
        planNo: "774",
        uin: "512N365V02",
        layout: 'layouts/main',
        additionalCSS: ['lic-amritbaal-774', 'schedule-modal']
    });
});
// Add this with your other policy routes
app.get('/policies/insurance/endowment/768', (req, res) => {
    res.render('policies/insurance/endowment/LIC-Jeevan-Azad-Plan-768', {
        title: "LIC's Jeevan Azad Plan 768",
        planNo: "768",
        uin: "512N348V02",
        layout: 'layouts/main',
        additionalCSS: ['lic-jeevan-azad-768', 'schedule-modal']
    });
});
app.get('/policies/insurance/endowment/760', (req, res) => {
    res.render('policies/insurance/endowment/LIC-Bima-Jyoti-Plan-760', {
        title: "LIC's Bima Jyoti Plan 760",
        planNo: "760",
        uin: "512N339V03",
        layout: 'layouts/main',
        additionalCSS: ['lic-bima-jyoti-760', 'schedule-modal']
    });
});

// Add this near the end of your file, after all other routes but before app.listen

// 404 page - This should be after all other routes
app.use((req, res) => {
    res.status(404).render('404');
});