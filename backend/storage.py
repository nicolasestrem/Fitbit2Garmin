
import shelve
from typing import Dict, List, Any, Tuple
import os
import atexit

# Define the storage file path
STORAGE_FILE = "fitbit2garmin_storage.db"

# Initialize the shelve file
db = shelve.open(STORAGE_FILE, writeback=True)

def cleanup():
    """Close the shelve file on exit."""
    db.close()

atexit.register(cleanup)

def get_uploaded_files() -> Dict[str, List[Dict[str, Any]]]:
    """Get the dictionary of uploaded files."""
    if "uploaded_files" not in db:
        db["uploaded_files"] = {}
    return db["uploaded_files"]

def get_converted_files() -> Dict[str, List[Tuple[str, bytes]]]:
    """Get the dictionary of converted files."""
    if "converted_files" not in db:
        db["converted_files"] = {}
    return db["converted_files"]

def get_usage_records() -> Dict[str, Any]:
    """Get the dictionary of usage records."""
    if "usage_records" not in db:
        db["usage_records"] = {}
    return db["usage_records"]
