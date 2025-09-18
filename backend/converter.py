"""
Fitbit Google Takeout to Garmin Converter
Adapted from our proven conversion algorithm
"""

import json
import io
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.weight_scale_message import WeightScaleMessage


class FitbitConverter:
    """Converts Fitbit Google Takeout JSON data to Garmin FIT format"""

    def __init__(self):
        self.conversion_count = 0

    def convert_pounds_to_kg(self, pounds: float) -> float:
        """Convert pounds to kilograms"""
        return round(pounds / 2.2046, 1)

    def extract_week_year_from_filename(self, filename: str) -> Optional[str]:
        """Extract week number from Google Takeout filename like weight-2025-05-15.json"""
        try:
            # Remove extension and split
            base_name = filename.replace('.json', '')
            parts = base_name.split('-')

            if len(parts) >= 4 and parts[0] == 'weight':
                year = int(parts[1])
                month = int(parts[2])
                day = int(parts[3])

                # Calculate week number
                date_obj = datetime(year, month, day)
                week_number = date_obj.isocalendar()[1]

                return f"{week_number}-{year}"
        except (ValueError, IndexError):
            pass
        return None

    def validate_google_takeout_format(self, data: List[Dict[str, Any]]) -> bool:
        """Validate that the JSON data matches Google Takeout format"""
        if not isinstance(data, list) or not data:
            return False

        # Check first entry for required fields
        first_entry = data[0]
        required_fields = ['logId', 'weight', 'date', 'time']

        return all(field in first_entry for field in required_fields)

    def process_json_data(self, json_data: List[Dict[str, Any]], filename: str) -> Tuple[bytes, int]:
        """
        Process Google Takeout JSON data and return FIT file bytes
        Returns: (fit_file_bytes, entry_count)
        """
        if not self.validate_google_takeout_format(json_data):
            raise ValueError("Invalid Google Takeout format. Expected weight data with logId, weight, date, time fields.")

        # Get week number for filename
        week_year = self.extract_week_year_from_filename(filename)
        if not week_year:
            # Fallback: use first entry date
            first_entry = json_data[0]
            try:
                date_obj = datetime.strptime(first_entry['date'], "%m/%d/%y")
                week_number = date_obj.isocalendar()[1]
                year = date_obj.year
                week_year = f"{week_number}-{year}"
            except ValueError:
                week_year = "1-2025"  # Default fallback

        # Create FIT file builder
        builder = FitFileBuilder(auto_define=True, min_string_size=50)

        # Add File ID message
        file_id_msg = FileIdMessage()
        file_id_msg.type = 4  # WEIGHT file type
        file_id_msg.manufacturer = 255  # FITBIT_ID
        file_id_msg.product = 1
        file_id_msg.product_name = "Health Sync"
        file_id_msg.serial_number = 1701
        file_id_msg.number = 0  # Critical: this field was missing initially

        # Use the first entry's logId for file creation time (Unix timestamp)
        first_entry = json_data[0]
        file_id_msg.time_created = first_entry['logId']

        builder.add(file_id_msg)

        # Process each weight entry
        weight_entries = []
        for entry in json_data:
            # Use logId directly as Unix timestamp (our breakthrough fix!)
            unix_timestamp = entry['logId']

            # Convert weight to kg
            weight_kg = self.convert_pounds_to_kg(entry['weight'])

            # Get body fat percentage if available
            body_fat = entry.get('fat', 0.0)
            if body_fat == 0.0:
                body_fat = None
            else:
                body_fat = round(body_fat, 1)

            # Create weight scale message - CRITICAL: Field order must match template exactly
            weight_msg = WeightScaleMessage()
            weight_msg.timestamp = unix_timestamp  # Unix timestamp (breakthrough fix!)
            weight_msg.weight = weight_kg
            weight_msg.bone_mass = 0.0  # Set to 0 as in sample - FIELD ORDER CRITICAL
            weight_msg.muscle_mass = 0.0  # Set to 0 as in sample - FIELD ORDER CRITICAL

            # percent_fat MUST come after bone_mass and muscle_mass to match template
            if body_fat is not None:
                weight_msg.percent_fat = body_fat

            weight_msg.percent_hydration = 0.0  # Set to 0 as in sample - MUST be last

            weight_entries.append(weight_msg)

        # Sort entries by timestamp
        weight_entries.sort(key=lambda x: x.timestamp)

        # Add all weight entries
        for weight_msg in weight_entries:
            builder.add(weight_msg)

        # Build the FIT file
        fit_file = builder.build()

        # Convert to bytes
        fit_bytes = fit_file.to_bytes()

        self.conversion_count += 1

        return fit_bytes, len(weight_entries)

    def get_output_filename(self, input_filename: str) -> str:
        """Generate output filename from input filename"""
        week_year = self.extract_week_year_from_filename(input_filename)
        if week_year:
            return f"Weight {week_year} Fitbit.fit"

        # Fallback naming
        return f"Weight Converted Fitbit.fit"


def convert_fitbit_to_garmin(json_files: List[Tuple[str, List[Dict[str, Any]]]]) -> List[Tuple[str, bytes]]:
    """
    Convert multiple Fitbit JSON files to Garmin FIT format

    Args:
        json_files: List of (filename, json_data) tuples

    Returns:
        List of (output_filename, fit_file_bytes) tuples

    Raises:
        ValueError: If file format is invalid
        Exception: If conversion fails
    """
    converter = FitbitConverter()
    results = []

    for filename, json_data in json_files:
        try:
            fit_bytes, entry_count = converter.process_json_data(json_data, filename)
            output_filename = converter.get_output_filename(filename)
            results.append((output_filename, fit_bytes))

            print(f"Converted {filename}: {entry_count} weight entries → {output_filename}")

        except Exception as e:
            print(f"Failed to convert {filename}: {str(e)}")
            raise

    return results