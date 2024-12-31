// services/openai.js
const OpenAI = require('openai');

console.log('OpenAI initialization, API key exists:', !!process.env.OPENAI_API_KEY);


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Field detection function
async function detectField(jobDescription, experience) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "system",
                content: "You are a job classification expert. Classify the job into one category: TECH, MEDICAL, FINANCE, SALES, EDUCATION, OTHER"
            }, {
                role: "user",
                content: `Job Description: ${jobDescription}\nExperience: ${experience}`
            }],
            temperature: 0.3,
            max_tokens: 50
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error('Failed to detect field');
    }
}

// Resume optimization function
async function optimizeResume(jobDescription, resume, field) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: `You are an expert resume optimizer for ${field} jobs. 
                         Optimize the resume to match the job description while maintaining truthfulness.`
            }, {
                role: "user",
                content: `Job Description: ${jobDescription}\nCurrent Resume: ${resume}`
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