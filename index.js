const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const products = require('./public/products.js'); // ✅ Load the product data directly

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/products', (req, res) => {
  res.json(products); // ✅ Respond with the array directly
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
