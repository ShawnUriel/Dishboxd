require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Only the Vite dev server may call the API, not every website (no "*" wildcard)
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// Test route to prove the server is running and CORS is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'Dishboxd backend is working!' });
});

// Unknown routes get a plain 404 instead of Express's default HTML page
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Log the real error on the server, but never send stack traces to the browser
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
