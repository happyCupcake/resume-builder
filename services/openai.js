// services/openai.js
const OpenAI = require('openai');

console.log('OpenAI initialization, API key exists:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Field detection function with more detailed industry categories
async function detectField(jobDescription, experience) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: `You are a job classification expert. Classify the job into one of these categories:
                - TECH (Software Engineering, Data Science, IT, Cybersecurity, etc.)
                - HEALTHCARE (Medical, Nursing, Pharmacy, etc.)
                - FINANCE (Banking, Investment, Accounting, etc.)
                - SALES (B2B, B2C, Retail, etc.)
                - MARKETING (Digital Marketing, Brand Management, PR, etc.)
                - ENGINEERING (Mechanical, Electrical, Civil, etc.)
                - EDUCATION (Teaching, Administration, etc.)
                - LEGAL (Law, Compliance, etc.)
                - CREATIVE (Design, Writing, Arts, etc.)
                - BUSINESS (Management, Operations, HR, etc.)
                - OTHER
                
                Return ONLY the category name, nothing else.`
            }, {
                role: "user",
                content: `Job Description: ${jobDescription}\nExperience: ${experience}`
            }],
            temperature: 0.2,
            max_tokens: 20
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to detect field');
    }
}

// Enhanced resume optimization function with ATS optimization
async function optimizeResume(jobDescription, resume, field) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "system",
                content: `You are an expert resume optimizer for ${field} positions. Your goal is to create a highly optimized resume 
                that will pass through Applicant Tracking Systems (ATS) and impress hiring managers.

                Follow these guidelines:
                
                1. MAINTAIN TRUTHFULNESS: Only use information provided in the original resume. Never invent experience, skills, or qualifications.
                
                2. ATS OPTIMIZATION:
                   - Include relevant keywords from the job description
                   - Use standard section headings (Summary, Experience, Education, Skills)
                   - Remove graphics, tables, and complex formatting
                   - Use industry-standard job titles
                
                3. CONTENT ENHANCEMENT:
                   - Strengthen achievement statements with metrics and results
                   - Prioritize relevant skills and experience
                   - Use action verbs and quantify accomplishments
                   - Add relevant technical skills mentioned in the job description if they appear in the original resume
                   - Focus on the most recent and relevant work experience
                
                4. FORMATTING AND STRUCTURE:
                   - Maintain a clean, professional format
                   - Create a compelling professional summary
                   - Arrange information in reverse chronological order
                   - Use consistent formatting for dates, company names, and positions
                
                5. OUTPUT FORMAT:
                   - Provide the complete optimized resume in a clean format
                   - Use line breaks and spacing to create clear sections
                
                Remember: The goal is to optimize the resume WITHOUT FABRICATING information while making it highly relevant to the specific job description.`
            }, {
                role: "user",
                content: `JOB DESCRIPTION:
                
                ${jobDescription}
                
                CURRENT RESUME:
                
                ${resume}`
            }],
            temperature: 0.7
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to optimize resume');
    }
}

module.exports = {
    detectField,
    optimizeResume
};