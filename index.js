const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs'); // Add this at the top with other requires
const fs = require('fs'); // Add this at the top with other requires
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

// Helper to truncate text with ellipsis
function truncate(str, maxLen = 60) {
  if (typeof str !== 'string') return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

// Endpoint to generate Excel with formatting (server-side)
app.post('/generate-excel', async (req, res) => {
  try {
    const { customer, items, total } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No products in cart. Cannot generate Excel.' });
    }

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Invoice');

    // Set print and view properties
    ws.pageSetup = {
      paperSize: 9, // A4 paper
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 85 // Slightly zoomed out for better visibility
    };

    // Set default row height
    ws.properties.defaultRowHeight = 20;

    // Set column widths
    ws.columns = [
      { width: 45 }, // Product
      { width: 12 }, // Qty
      { width: 18 }, // Unit Price
      { width: 20 }, // Amount
    ];

    // Helper for styling
    const headerFont = { name: 'Poppins', size: 14, bold: true };
    const subHeaderFont = { name: 'Poppins', size: 11, bold: true };
    const normalFont = { name: 'Poppins', size: 11 };
    const lightFont = { name: 'Poppins', size: 10, color: { argb: 'FF888888' } };

    let row = 1;

    // Company Name (Header) - taller row
    ws.getRow(1).height = 30;
    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = 'HERMAS UNANI';
    ws.getCell('A1').font = { ...headerFont, size: 18, color: { argb: 'FF008080' } };
    ws.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

    // Company Contact Info - slightly taller
    ws.getRow(2).height = 25;
    ws.mergeCells('A2:D2');
    ws.getCell('A2').value = 'care@hermas.in | +91 8129 351 352 | www.hermasunani.com';
    ws.getCell('A2').font = lightFont;
    ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

    row = 3;

    // Invoice Title - taller row
    ws.getRow(3).height = 35;
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`A${row}`).value = 'INVOICE';
    ws.getCell(`A${row}`).font = { ...headerFont, size: 15 };
    ws.getCell(`A${row}`).alignment = { horizontal: 'center', vertical: 'middle' };
    row++;

    // Customer & Invoice Meta (modified for better text handling)
    ws.getCell(`A${row}`).value = 'Bill To:';
    ws.getCell(`A${row}`).font = subHeaderFont;
    ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = customer.name || '';
    ws.getCell(`B${row}`).font = normalFont;
    row++;

    // Date on separate row
    ws.getCell(`A${row}`).value = 'Date:';
    ws.getCell(`A${row}`).font = subHeaderFont;
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = customer.date || '';
    ws.getCell(`B${row}`).font = normalFont;
    row++;

    ws.getCell(`A${row}`).value = 'Address:';
    ws.getCell(`A${row}`).font = subHeaderFont;
    ws.getCell(`A${row}`).alignment = { horizontal: 'left' };
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = customer.address || '';
    ws.getCell(`B${row}`).font = normalFont;
    ws.getCell(`B${row}`).alignment = { horizontal: 'left', wrapText: true };
    row++;

    ws.getCell(`A${row}`).value = 'WhatsApp:';
    ws.getCell(`A${row}`).font = subHeaderFont;
    ws.mergeCells(`B${row}:D${row}`);
    ws.getCell(`B${row}`).value = customer.phone || '';
    ws.getCell(`B${row}`).font = normalFont;
    row++;

    row++; // Blank row

    // Table Header
    ws.getRow(row).values = ['Product', 'Qty', 'Unit Price (₹)', 'Amount (₹)'];
    ws.getRow(row).font = { ...subHeaderFont, color: { argb: 'FF008080' } };
    ws.getRow(row).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(row).border = {
      bottom: { style: 'thin', color: { argb: 'FF008080' } }
    };
    ws.getRow(row).height = 25;
    row++;

    // Table Body
    let tableStartRow = row;
    items.forEach(item => {
      ws.getRow(row).height = 22;
      ws.getRow(row).values = [
        truncate(item.name, 60),
        item.qty,
        Number(item.rate),
        Number(item.qty * item.rate)
      ];
      ws.getRow(row).font = normalFont;
      ws.getRow(row).alignment = { vertical: 'middle', horizontal: 'center' };
      // Remove the special alignment for column A since we want everything centered
      // Format Unit Price and Amount as currency
      ws.getCell(`C${row}`).numFmt = '"₹"#,##0.00';
      ws.getCell(`D${row}`).numFmt = '"₹"#,##0.00';
      row++;
    });

    // Table bottom border
    ws.getRow(row - 1).border = {
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };

    // Only show TOTAL (no subtotal)
    ws.mergeCells(`A${row}:C${row}`);
    ws.getCell(`A${row}`).value = 'TOTAL';
    ws.getCell(`A${row}`).alignment = { horizontal: 'right' };
    ws.getCell(`A${row}`).font = { ...headerFont, size: 13 };
    ws.getCell(`D${row}`).value = Number(total); // Pass as number
    ws.getCell(`D${row}`).numFmt = '"₹"#,##0.00'; // Format as currency
    ws.getCell(`D${row}`).font = { ...headerFont, size: 13 };
    ws.getCell(`D${row}`).alignment = { horizontal: 'center' };
    ws.getRow(row).height = 25;
    row += 2;

    // Thank you note - taller row
    ws.getRow(row).height = 30;
    ws.mergeCells(`A${row}:D${row}`);
    ws.getCell(`A${row}`).value = 'Thank you for your business!';
    ws.getCell(`A${row}`).font = { ...normalFont, italic: true, color: { argb: 'FF008080' } };
    ws.getCell(`A${row}`).alignment = { horizontal: 'center' };

    // --- Minimal borders for table area ---
    for (let r = tableStartRow; r < row - 4; r++) {
      ws.getRow(r).border = {
        bottom: { style: 'hair', color: { argb: 'FFEEEEEE' } }
      };
    }

    // Freeze panes to keep header visible
    ws.views = [
      { state: 'frozen', ySplit: tableStartRow - 1 }
    ];

    // --- Response Headers ---
    // Sanitize customer name for filename (remove special chars, trim, replace spaces with _)
    let safeName = (customer.name || 'Customer')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    if (!safeName) safeName = 'Customer';

    // Use a readable date (YYYY-MM-DD)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10); // e.g., "2024-06-10"

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${safeName}_Invoice_${dateStr}.xlsx`
    );

    await workbook.xlsx.write(res);
    // Do NOT call res.end() after write(res) as ExcelJS handles the stream end.
  } catch (err) {
    console.error('Excel generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
