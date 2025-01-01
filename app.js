// app.js
const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { detectField, optimizeResume } = require('./services/openai');



const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Add this test route in app.js
app.get('/test', async (req, res) => {
    try {
        const sampleJobDescription = "Looking for a Senior Software Engineer with 5+ years of experience in Python and JavaScript. Must have experience with React and Node.js.";
        const sampleResume = "Software Engineer with 6 years of experience in web development. Proficient in Python, JavaScript, and React.";
        
        // Test field detection
        const field = await detectField(sampleJobDescription, sampleResume);
        console.log('Detected Field:', field);
        
        // Test resume optimization
        const optimizedResume = await optimizeResume(sampleJobDescription, sampleResume, field);
        
        res.json({
            field: field,
            optimizedResume: optimizedResume
        });
    } catch (error) {
        console.error('Test Error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});

// Basic route
app.get('/', (req, res) => {
    res.render('index');
});

// Add to app.js - add this route before the generate route
app.post('/analyze', async (req, res) => {
    try {
        const { jobDescription, resume } = req.body;
        
        // First detect the field
        const field = await detectField(jobDescription, resume);

        // Improved keyword matching
        const cleanText = text => text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')  // Remove punctuation
            .replace(/\s+/g, ' ')      // Normalize spaces
            .trim();

        const getWords = text => cleanText(text).split(' ').filter(word => word.length > 2);
        
        const jobWords = new Set(getWords(jobDescription));
        const resumeWords = new Set(getWords(resume));
        
        // Find matching keywords
        const matchingWords = [...jobWords].filter(word => resumeWords.has(word));
        const score = Math.round((matchingWords.length / jobWords.size) * 100);

        console.log('Keywords found:', matchingWords); // Debug log

        // Optimize resume
        const optimizedResume = await optimizeResume(jobDescription, resume, field);
        
        // Log for now
        console.log('Field detected:', field);
        console.log('Job Description:', jobDescription);
        console.log('Resume:', resume);
        
        res.json({
            success: true,
            field: field,
            score: score,
            matchingWords: matchingWords.slice(0, 5),
            optimizedResume: await optimizeResume(jobDescription, resume, field)
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Analysis failed' 
        });
    }
});


// Add this to app.js after the existing routes
app.post('/generate', (req, res) => {
    const { jobUrl, resume } = req.body;
    // For now, just log the data
    console.log('Job URL:', jobUrl);
    console.log('Resume:', resume);
    res.send('Form submitted successfully!');
});


const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-payment-intent', async (req, res) => {
    try {
        const { userId } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: 500, // $5.00
            currency: 'usd',
            metadata: {
                userId: userId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/payment-complete', (req, res) => {
    res.render('payment-complete');  // We'll create this view
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});