"""
Vercel serverless function entry point
This file is required for Vercel to recognize the FastAPI app
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import our modules
sys.path.append(str(Path(__file__).parent.parent))

from main import app

# Vercel expects a variable named 'app' or 'handler'
handler = app