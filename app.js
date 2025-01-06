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

const db = require('./db');

app.post('/analyze', async (req, res) => {
    try {
        const { jobDescription, resume, userId } = req.body;
        console.log('Starting analysis for userId:', userId);
        
        // First ensure user exists
        const userCheck = await db.query(
            'SELECT user_id FROM users WHERE user_id = $1',
            [userId]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'User not found'
            });
        }

        // Validate inputs
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'User ID is required' 
            });
        }

        if (!jobDescription || !resume) {
            return res.status(400).json({
                success: false,
                error: 'Job description and resume are required'
            });
        }
        
        // Get field and optimized resume
        const field = await detectField(jobDescription, resume);
        const optimizedResume = await optimizeResume(jobDescription, resume, field);
        
        // Calculate keyword match
        const jobWords = new Set(jobDescription.toLowerCase().match(/\b\w+\b/g));
        const resumeWords = new Set(resume.toLowerCase().match(/\b\w+\b/g));
        const matchingWords = [...jobWords].filter(word => resumeWords.has(word));
        const score = Math.round((matchingWords.length / jobWords.size) * 100);

        console.log('Inserting new analysis into database');
        // Save to database
        const result = await db.query(
            `INSERT INTO analyses 
            (user_id, job_description, original_resume, optimized_resume, field, score, matching_keywords, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING analysis_id`,
            [userId, jobDescription, resume, optimizedResume, field, score, matchingWords, 'preview']
        );

        console.log('Insert operation result:', result.rows[0]);

        // Send preview data
        res.json({
            success: true,
            analysisId: result.rows[0].analysis_id,
            field: field,
            score: score,
            matchingWords: matchingWords.slice(0, 5)  // Only sending top 5 keywords
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Analysis failed' });
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
        const { userId, analysisId } = req.body;  // Get analysisId too

        const paymentIntent = await stripe.paymentIntents.create({
            amount: 500, // $5.00
            currency: 'usd',
            metadata: {
                userId: userId,
                analysisId: analysisId
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

// New endpoint to get results after payment
app.post('/get-full-results', async (req, res) => {
    try {
        const { analysisId } = req.body;
        
        const result = await db.query(
            'SELECT optimized_resume FROM analyses WHERE analysis_id = $1 AND status = $2',
            [analysisId, 'paid']
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                optimizedResume: result.rows[0].optimized_resume
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Results not found or not paid'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve results' });
    }
});

// Update payment status
app.post('/update-payment-status', async (req, res) => {
    try {
        const { analysisId, paymentId } = req.body;
        console.log('Updating payment status for:', {analysisId, paymentId});
        
        const checkRow = await db.query(
            'SELECT * FROM analyses WHERE analysis_id = $1',
            [analysisId]
        );
        console.log('Existing row:', checkRow.rows[0]);
        
        const result =await db.query(
            'UPDATE analyses SET status = $1, payment_id = $2 WHERE analysis_id = $3 RETURNING *',
            ['paid', paymentId, analysisId]
        );
        console.log('Update result:', result.rows[0]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, error: 'Failed to update payment status' });
    }
});

app.get('/payment-complete', (req, res) => {
    res.render('payment-complete');  // We'll create this view
});

app.post('/upsert-user', async (req, res) => {
    try {
        const { userId, email } = req.body;
        console.log('Upserting user:', userId, email);
        
        const result = await db.query(
            `INSERT INTO users (user_id, email) 
             VALUES ($1, $2) 
             ON CONFLICT (user_id) 
             DO UPDATE SET email = EXCLUDED.email
             RETURNING *`,  // Added RETURNING to see what happened
            [userId, email]
        );
        
        console.log('Upsert result:', result.rows[0]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error upserting user:', error);
        res.status(500).json({ success: false, error: 'Failed to upsert user' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});