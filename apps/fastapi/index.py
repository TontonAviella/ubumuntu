# Vercel serverless entry point - must be at root
import sys
import os

# Add the current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.main import app

# Vercel looks for 'app' or 'handler'
handler = app
