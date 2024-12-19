require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Required for secure connections in hosted environments
});

app.use(cors());
app.use(bodyParser.json());

// Routes

// Get all URLs
app.get('/urls', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM urls');
        res.json(result.rows); // Include the completed status in the response
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Add a new URL
app.post('/urls', async (req, res) => {
    const { url } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO urls (url, completed) VALUES ($1, $2) RETURNING *', 
            [url, false] // Default 'completed' to false
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Remove a URL by ID
app.delete('/urls/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM urls WHERE id = $1', [id]);
        res.send('URL deleted successfully');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Update the 'completed' status of a URL
app.put('/urls/:id', async (req, res) => {
    const { id } = req.params;
    const { completed } = req.body; // Expecting completed status (true/false)
    try {
        const result = await pool.query(
            'UPDATE urls SET completed = $1 WHERE id = $2 RETURNING *',
            [completed, id]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]); // Return the updated URL with the completed status
        } else {
            res.status(404).send('URL not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});