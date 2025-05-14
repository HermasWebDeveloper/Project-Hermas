const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Load product data from JS file
const products = require('./public/products.js');

app.use(express.json());

// Serve frontend files from /public folder
app.use(express.static('public'));

// Homepage route (serves index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API route to get all products
app.get('/products', (req, res) => {
  res.json(products);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
