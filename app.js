require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------
// ----------------- PLAYLIST ACTIONS ----------------
// ---------------------------------------------------

async function fetchVideosFromPlaylist(playlistId) {
    const apiKey = process.env.API_KEY; 
    const baseUrl = 'https://www.googleapis.com/youtube/v3/playlistItems';
    const maxResults = 50; 
    let videoIds = [];
    let nextPageToken = '';

    try {
        do {
            const url = `${baseUrl}?part=contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&pageToken=${nextPageToken}&key=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`YouTube API error: ${response.statusText}`);
            }

            const data = await response.json();
            const ids = data.items.map(item => item.contentDetails.videoId);
            videoIds = videoIds.concat(ids);

            nextPageToken = data.nextPageToken || '';
        } while (nextPageToken); 

        return videoIds;
    } catch (error) {
        console.error('Error fetching videos from playlist:', error);
        return [];
    }
}

// Add all video URLs from playlist to the database
app.post('/urls/playlist', async (req, res) => {
    const { url, isPlaylist } = req.body;

    if (isPlaylist) {
        const videoUrls = await fetchVideosFromPlaylist(url);
        console.log(videoUrls);
        if (!videoUrls || videoUrls.length === 0) {
            return res.status(400).send('No Videos Found in Playlist.');
        }
        try {
            for (const videoUrl of videoUrls) {
                await pool.query('INSERT INTO urls (playlist, url) VALUES ($1, $2)', [url, videoUrl]);
            }
            res.status(200).send('Videos added successfully.');
        } catch (err) {
            console.error('Error storing video URLs:', err);
            res.status(500).send(`Error storing video URLs: ${err.message}`);
        }
    }
    else {
        try {
            await pool.query('INSERT INTO urls (playlist, url) VALUES ($1, $2)', ['NO PLAYLIST', url]);
            res.status(200).send('Video added successfully.');
        } catch (err) {
            console.error('Error storing video URL:', err);
            res.status(500).send(`Error storing video URL: ${err.message}`);
        }
    }
});

// Get video URLs by playlist
app.get('/urls/playlist', async (req, res) => {
    const { playlistUrl } = req.query;
    
    if (!playlistUrl) {
        return res.status(400).send('Playlist URL is required.');
    }

    try {
        const result = await pool.query('SELECT * FROM urls WHERE playlist = $1', [playlistUrl]);
        console.log(result.rows);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Get unique playlists
app.get('/urls/playlist/all', async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT playlist FROM urls');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Toggle the "completed" status of a playlist
app.put('/urls/playlist/all', async (req, res) => {
    const { playlistUrl, completed } = req.body;

    if (!playlistUrl) {
        return res.status(400).send('Playlist URL is required.');
    }

    try {
        await pool.query('UPDATE urls SET completed = $1 WHERE playlist = $2', [completed, playlistUrl]);
        res.status(200).send('Playlist completion status updated.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Remove a playlist from the database
app.delete('/urls/playlist/all', async (req, res) => {
    const { playlistUrl } = req.body;

    if (!playlistUrl) {
        return res.status(400).send('Playlist URL is required.');
    }

    try {
        await pool.query('DELETE FROM urls WHERE playlist = $1', [playlistUrl]);
        res.status(200).send('Playlist removed.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// ---------------------------------------------------
// ---------------- VIDEO ACTIONS --------------------
// ---------------------------------------------------

// Toggle the "completed" status of a video
app.put('/urls/playlist', async (req, res) => {
    const { videoUrl, completed } = req.body;

    if (!videoUrl) {
        return res.status(400).send('Video URL is required.');
    }

    try {
        await pool.query('UPDATE urls SET completed = $1 WHERE url = $2', [completed, videoUrl]);
        res.status(200).send('Video completion status updated.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Remove a video from the database
app.delete('/urls/playlist', async (req, res) => {
    const { videoUrl } = req.body;

    if (!playlistUrl) {
        return res.status(400).send('Video URL is required.');
    }

    try {
        await pool.query('DELETE FROM urls WHERE url = $1', [videoUrl]);
        res.status(200).send('Video removed.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});