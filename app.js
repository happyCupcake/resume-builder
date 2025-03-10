// app.js
const express = require('express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const { detectField, analyzeATS, optimizeResume } = require('./services/openai');



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
        
        // Calculate keyword match (original approach for backward compatibility)
        const jobWords = new Set(jobDescription.toLowerCase().match(/\b\w+\b/g) || []);
        const resumeWords = new Set(resume.toLowerCase().match(/\b\w+\b/g) || []);
        const matchingWords = [...jobWords].filter(word => resumeWords.has(word));
        const score = Math.round((matchingWords.length / (jobWords.size || 1)) * 100);
        
        let atsAnalysis;
        // Try to get ATS analysis, but handle if it fails
        try {
            atsAnalysis = await analyzeATS(jobDescription, resume);
        } catch (atsError) {
            console.error("ATS Analysis failed:", atsError);
            // Create a fallback object if ATS analysis fails
            atsAnalysis = {
                atsScore: score,
                missingKeywords: [],
                formatIssues: ["Unable to analyze format issues at this time"],
                improvementSuggestions: ["Try including more keywords from the job description"],
                keyStrengths: []
            };
        }

        console.log('Inserting new analysis into database');
        // Save to database (need to update DB schema to include ATS analysis)
        const result = await db.query(
            `INSERT INTO analyses 
            (user_id, job_description, original_resume, optimized_resume, field, score, matching_keywords, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING analysis_id`,
            [userId, jobDescription, resume, optimizedResume, field, atsAnalysis.atsScore || score, matchingWords, 'preview']
        );

        console.log('Insert operation result:', result.rows[0]);

        // Send preview data with ATS analysis
        res.json({
            success: true,
            analysisId: result.rows[0].analysis_id,
            field: field,
            score: atsAnalysis.atsScore || score,
            matchingWords: matchingWords.slice(0, 5),  // Only sending top 5 keywords
            atsAnalysis: {
                missingKeywords: atsAnalysis.missingKeywords || [],
                formatIssues: atsAnalysis.formatIssues || [],
                improvementSuggestions: atsAnalysis.improvementSuggestions || [],
                keyStrengths: atsAnalysis.keyStrengths || []
            }
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
            amount: 99, // $0.99
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

// Convert HTML to PDF
const puppeteer = require('puppeteer');

//const PDFDocument = require('pdfkit');

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

app.post('/convert-to-pdf-better', async (req, res) => {
  try {
    const { text } = req.body;
    
    // Create a PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts - using multiple fonts for better typography
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    // Add a page
    let page = pdfDoc.addPage([595, 842]); // A4 size
    
    // Define emoji mappings with fancy representations
    const emojiMappings = {
      '📍': { symbol: '📍', text: 'Location:' },
      '📧': { symbol: '📧', text: 'Email:' },
      '📞': { symbol: '📞', text: 'Phone:' },
      '🔗': { symbol: '🔗', text: 'LinkedIn:' }
    };
    
    // Colors
    const primaryColor = rgb(0.1, 0.1, 0.1); // Almost black
    const secondaryColor = rgb(0.2, 0.4, 0.7); // Professional blue
    const accentColor = rgb(0.5, 0.5, 0.5); // Mid-gray
    
    // Set margins and dimensions
    const margin = 72; // 1 inch margins
    const pageWidth = 595;
    const contentWidth = pageWidth - (margin * 2);
    
    // Starting position from top
    let y = 770;
    let lineHeight = 14;
    
    // Parse the resume content
    const sections = text.split('\n\n');
    
    // Draw name at the top (first line of the first section)
    if (sections.length > 0) {
      const nameLine = sections[0].split('\n')[0];
      page.drawText(nameLine, {
        x: margin,
        y,
        size: 24, // Larger size for name
        font: timesBold,
        color: primaryColor
      });
      
      y -= 30; // More space after name
      
      // Draw thick horizontal line under name
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 2,
        color: secondaryColor
      });
      
      y -= 20; // Space after the line
    }
    
    // Process contact information (remaining lines of first section)
    if (sections.length > 0) {
      const contactLines = sections[0].split('\n').slice(1);
      
      // Handle contact info with special formatting
      for (const contactLine of contactLines) {
        if (contactLine.trim() === '---') continue; // Skip separator lines
        
        // Replace emojis with formatted text
        let formattedLine = contactLine;
        let contactX = margin;
        
        // Check and replace emojis
        Object.entries(emojiMappings).forEach(([emoji, mapping]) => {
          if (contactLine.includes(emoji)) {
            const parts = contactLine.split(emoji)[1].split('|');
            const infoValue = parts[0].trim();
            
            // Draw label with secondary color
            page.drawText(mapping.text, {
              x: contactX,
              y,
              size: 10,
              font: helveticaBold,
              color: secondaryColor
            });
            
            contactX += helveticaBold.widthOfTextAtSize(mapping.text, 10) + 5;
            
            // Draw value
            page.drawText(infoValue, {
              x: contactX,
              y,
              size: 10,
              font: helvetica,
              color: primaryColor
            });
            
            contactX += helvetica.widthOfTextAtSize(infoValue, 10) + 20; // Extra spacing between items
            
            // Don't create a new line for each item, place them horizontally
            formattedLine = null;
          }
        });
        
        // If line wasn't processed as an emoji, draw it normally
        if (formattedLine) {
          page.drawText(formattedLine, {
            x: margin,
            y,
            size: 10,
            font: helvetica,
            color: primaryColor
          });
          y -= lineHeight;
        }
      }
      
      // Move down after contact info
      y -= 15;
    }
    
    // Process remaining sections
    for (let i = 1; i < sections.length; i++) {
      // Skip empty sections
      if (!sections[i].trim()) continue;
      
      // Check if we need to add a new page
      if (y < 100) {
        page = pdfDoc.addPage([595, 842]);
        y = 770;
      }
      
      const sectionLines = sections[i].split('\n');
      
      // Process section header (first line)
      if (sectionLines[0]) {
        // Skip separator lines
        if (sectionLines[0].trim() === '---') {
          y -= 10;
          continue;
        }
        
        // Check if it's a section header (typically has ** or similar formatting)
        const isHeader = sectionLines[0].includes('**');
        if (isHeader) {
          // Clean the header (remove ** markers)
          const cleanHeader = sectionLines[0].replace(/\*\*/g, '');
          
          // Draw section header with larger font and color
          page.drawText(cleanHeader, {
            x: margin,
            y,
            size: 16,
            font: timesBold,
            color: secondaryColor
          });
          
          y -= 20;
          
          // Draw a line below section headers
          page.drawLine({
            start: { x: margin, y },
            end: { x: pageWidth - margin, y },
            thickness: 1,
            color: accentColor
          });
          
          y -= 15;
        } else {
          // Normal text (not a header)
          page.drawText(sectionLines[0], {
            x: margin,
            y,
            size: 10,
            font: helvetica,
            color: primaryColor
          });
          
          y -= lineHeight;
        }
      }
      
      // Process section content (remaining lines)
      for (let j = 1; j < sectionLines.length; j++) {
        const line = sectionLines[j];
        
        // Check if we need a new page
        if (y < 60) {
          page = pdfDoc.addPage([595, 842]);
          y = 770;
        }
        
        // Skip separator lines
        if (line.trim() === '---') continue;
        
        // Check line type for different formatting
        if (line.match(/^\s*\*\*.+\*\*\s*$/)) {
          // Subsection title (line with ** markers)
          const cleanLine = line.replace(/\*\*/g, '');
          page.drawText(cleanLine, {
            x: margin,
            y,
            size: 14,
            font: helveticaBold,
            color: secondaryColor
          });
          
          y -= lineHeight + 2;
        } else if (line.match(/^\s*-\s+.+/)) {
          // Bullet point
          const bulletContent = line.replace(/^\s*-\s+/, '');
          const bulletIndent = 10;
          
          // Draw bullet
          page.drawText('•', {
            x: margin,
            y,
            size: 10,
            font: helvetica,
            color: secondaryColor
          });
          
          // Draw bullet text, indented
          page.drawText(bulletContent, {
            x: margin + bulletIndent,
            y,
            size: 10,
            font: helvetica,
            color: primaryColor
          });
          
          y -= lineHeight;
        } else if (line.trim()) {
          // Regular text - check if it's a job title or date line
          if (line.includes(',') && line.match(/\d{4}/) && !line.includes('-')) {
            // Company and location line
            page.drawText(line, {
              x: margin,
              y,
              size: 11,
              font: helveticaBold,
              color: primaryColor
            });
          } else if (line.match(/\d{4}\s*[–-]\s*(\d{4}|Present)/i)) {
            // Date range - more emphasis
            page.drawText(line, {
              x: margin,
              y,
              size: 11,
              font: helveticaBold,
              color: secondaryColor
            });
          } else {
            // Regular text
            page.drawText(line, {
              x: margin,
              y,
              size: 10,
              font: helvetica,
              color: primaryColor
            });
          }
          
          y -= lineHeight;
        } else {
          // Blank line - add some space
          y -= 5;
        }
      }
      
      // Add some space between sections
      y -= 15;
    }
    
    // Return the PDF
    const pdfBytes = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="professional-resume.pdf"');
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Error generating PDF' });
  }
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