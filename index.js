const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Load product data directly from products.js (should be CommonJS, not window.products)
const products = require('./public/products.js'); // products.js must use module.exports

app.use(express.json());

// ✅ Serve static files (your HTML, CSS, etc.)
app.use(express.static('public'));

// ✅ Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ API route to return product list
app.get('/products', (req, res) => {
  res.json(products);
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
