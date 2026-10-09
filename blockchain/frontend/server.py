from http.server import HTTPServer, SimpleHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 5500

server = HTTPServer(
    (HOST, PORT),
    SimpleHTTPRequestHandler
)

print(f"Serveur lancé sur http://{HOST}:{PORT}")

server.serve_forever()