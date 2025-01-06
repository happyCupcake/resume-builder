// db.js
const { Pool } = require('pg');

const pool = new Pool({
    user: 'resumeuser',
    host: 'localhost',
    database: 'resumebuilder',
    password: 'your_password',
    port: 5432,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};4