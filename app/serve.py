#!/usr/bin/env python3
"""
Unified C Compiler & Assembly Debugger Server
Combines TinyCC compilation with Unicorn debugging
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

# Configuration
PORT = 8006
HOST = 'localhost'

class LocalHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def end_headers(self):
        # Add headers to prevent caching and enable WASM
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

def main():
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print(f"🚀 Starting Unified C Compiler & Assembly Debugger Server...")
    print(f"📂 Serving from: {script_dir}")
    print(f"🌐 URL: http://{HOST}:{PORT}")
    print(f"✨ Features: TinyCC compilation + Unicorn debugging + 64-bit support")
    print(f"🔒 Completely offline - no internet required!")
    print()
    
    # Check for required files
    required_files = [
        'index.html', 
        'demo.js', 
        'raw-code-loader.js',
        'build-tcc/tcc.mjs',
        'externals/unicorn-x86.min.js'
    ]
    missing_files = [f for f in required_files if not Path(f).exists()]
    
    if missing_files:
        print(f"❌ Missing required files: {missing_files}")
        print("Make sure you're in the app directory with all copied files")
        sys.exit(1)
    
    try:
        with socketserver.TCPServer((HOST, PORT), LocalHTTPRequestHandler) as httpd:
            print(f"✅ Server running at http://{HOST}:{PORT}")
            print("📖 Open the URL above in your browser")
            print("🛑 Press Ctrl+C to stop the server")
            print()
            
            # Try to open browser automatically
            try:
                webbrowser.open(f'http://{HOST}:{PORT}')
                print("🌐 Browser opened automatically")
            except:
                print("⚠️  Could not open browser automatically")
            
            print("\n" + "="*60)
            print("HOW TO USE THE UNIFIED APP:")
            print("1. 📝 Write C code in the editor")
            print("2. 🔨 Click 'Compile Code' to generate machine code")
            print("3. 🐛 Click 'Start Debugging' to debug step by step")
            print("4. ▶️ Use 'Step' button to execute instruction by instruction")
            print("5. 👀 Watch registers and stack change in real-time")
            print("="*60 + "\n")
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {PORT} is already in use")
            print(f"Try: python3 serve.py")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()