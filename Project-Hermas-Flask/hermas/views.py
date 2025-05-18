from flask import Flask, jsonify, request, send_file, render_template
try:
    from .products import products
except Exception as e:
    products = None
    import sys
    print("Error importing products:", e, file=sys.stderr)
from io import BytesIO
import xlsxwriter
from datetime import datetime

# Explicitly set static and template folders (optional, but recommended for production)
app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/health')
def health():
    # In production, you may want to restrict or remove this endpoint
    return jsonify({"status": "ok"})

@app.route('/')
def home():
    try:
        return render_template('index.html')
    except Exception:
        return "Internal Server Error", 500

@app.route('/products')
def get_products():
    if products is None:
        return jsonify({"error": "Products data could not be loaded."}), 500
    return jsonify(products)

@app.route('/generate-excel', methods=['POST'])
def generate_excel():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        customer = data.get('customer', {})
        items = data.get('items', [])
        total = data.get('total', 0)

        # Validate required fields
        if not customer or not items:
            return jsonify({'error': 'Missing customer or items data'}), 400

        output = BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        ws = workbook.add_worksheet('QUOTATION')

        # Set column widths
        ws.set_column('A:A', 34.50)  # Set column A width to 34.50 points
        ws.set_column('B:B', 12)
        ws.set_column('C:C', 18)
        ws.set_column('D:D', 20)

        # Define formats
        header_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 18, 'bold': True, 'font_color': '#008080', 'align': 'left', 'valign': 'vcenter'})
        light_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 10, 'font_color': '#888888', 'align': 'left', 'valign': 'vcenter'})
        purchase_order_title_fmt = workbook.add_format({
            'font_name': 'Poppins', 'font_size': 15, 'bold': True,
            'align': 'left', 'valign': 'vcenter',
            'top': 2, 'top_color': '#008080'  # Only upper line, no bottom line
        })  # Add thick border top for PURCHASE ORDER
        subheader_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'bold': True, 'align': 'left'})
        normal_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11})
        wrap_left_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'align': 'left', 'text_wrap': True})
        table_header_fmt = workbook.add_format({
            'font_name': 'Poppins', 'font_size': 11, 'bold': True, 'font_color': '#008080',
            'align': 'center', 'valign': 'vcenter',
            'top': 2, 'top_color': '#008080',
            'bottom': 2, 'bottom_color': '#008080'
        })
        product_header_fmt = workbook.add_format({
            'font_name': 'Poppins', 'font_size': 11, 'bold': True, 'font_color': '#008080',
            'align': 'left', 'valign': 'vcenter',
            'top': 2, 'top_color': '#008080',
            'bottom': 2, 'bottom_color': '#008080'
        })  # Product column header: left align, middle, thick border
        product_cell_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'align': 'left', 'valign': 'vcenter'})
        table_cell_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'align': 'center', 'valign': 'vcenter'})
        currency_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'align': 'center', 'valign': 'vcenter', 'num_format': u'₹#,##0.00'})
        total_label_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 13, 'bold': True, 'align': 'right'})
        total_value_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 13, 'bold': True, 'align': 'center', 'num_format': u'₹#,##0.00'})
        thankyou_fmt = workbook.add_format({'font_name': 'Poppins', 'font_size': 11, 'italic': True, 'font_color': '#008080', 'align': 'center'})

        row = 0

        # Company Name (Header)
        ws.merge_range(row, 0, row, 3, 'HERMAS UNANI', header_fmt)
        ws.set_row(row, 30)
        row += 1

        # Company Contact Info (phone number updated)
        ws.merge_range(row, 0, row, 3, 'care@hermas.in | +91 7356 444 012 | www.hermasunani.com', light_fmt)
        ws.set_row(row, 25)
        row += 1

        # PURCHASE ORDER Title with thick border top only, left aligned
        ws.merge_range(row, 0, row, 3, 'PURCHASE ORDER', purchase_order_title_fmt)
        ws.set_row(row, 35)
        row += 1

        # Customer Info
        ws.write(row, 0, 'Bill To:', subheader_fmt)
        ws.merge_range(row, 1, row, 3, customer.get('name', ''), normal_fmt)
        row += 1

        ws.write(row, 0, 'Date:', subheader_fmt)
        ws.merge_range(row, 1, row, 3, customer.get('date', ''), normal_fmt)
        row += 1

        ws.write(row, 0, 'Address:', subheader_fmt)
        ws.merge_range(row, 1, row, 3, customer.get('address', ''), wrap_left_fmt)
        row += 1

        ws.write(row, 0, 'WhatsApp:', subheader_fmt)
        ws.merge_range(row, 1, row, 3, customer.get('phone', ''), normal_fmt)
        row += 2  # Blank row

        # Table Header: 'Product' left aligned, others centered, all with thick border top and bottom
        ws.write(row, 0, 'Product', product_header_fmt)
        ws.write(row, 1, 'Qty', table_header_fmt)
        ws.write(row, 2, 'Unit Price (₹)', table_header_fmt)
        ws.write(row, 3, 'Amount (₹)', table_header_fmt)
        ws.set_row(row, 25)
        table_header_row = row
        row += 1

        # Table Body
        table_start_row = row
        for item in items:
            ws.write(row, 0, (item['name'][:60] + '...') if len(item['name']) > 60 else item['name'], product_cell_fmt)
            ws.write(row, 1, item['qty'], table_cell_fmt)
            ws.write(row, 2, item['rate'], currency_fmt)
            ws.write(row, 3, item['qty'] * item['rate'], currency_fmt)
            ws.set_row(row, 22)
            row += 1

        # TOTAL row
        ws.merge_range(row, 0, row, 2, 'TOTAL', total_label_fmt)
        ws.write(row, 3, float(total), total_value_fmt)
        ws.set_row(row, 25)
        row += 2

        # Thank you note
        ws.merge_range(row, 0, row, 3, 'Thank you for your business!', thankyou_fmt)
        ws.set_row(row, 30)

        # Freeze panes
        ws.freeze_panes(table_start_row, 0)

        # Prepare filename
        safe_name = (customer.get('name') or 'Customer')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c == ' ').strip().replace(' ', '_') or 'Customer'
        date_str = datetime.now().strftime('%Y-%m-%d')
        filename = f"{safe_name}_Invoice_{date_str}.xlsx"

        workbook.close()
        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        import traceback
        print("Excel generation error:", e)
        traceback.print_exc()
        # Do not expose internal error details in production
        return jsonify({'error': 'Failed to generate Excel file'}), 500
