from hermas.views import app

if __name__ == "__main__":
    # Use Waitress for production WSGI serving
    from waitress import serve
    serve(app, host='0.0.0.0', port=5000)
