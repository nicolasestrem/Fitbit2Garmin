#!/usr/bin/env python3
import json
import glob
from datetime import datetime, timezone
import calendar
from fit_tool.fit_file_builder import FitFileBuilder
from fit_tool.profile.messages.file_id_message import FileIdMessage
from fit_tool.profile.messages.weight_scale_message import WeightScaleMessage

def convert_date_to_unix_timestamp(date_str, time_str):
    """Convert MM/DD/YY date and HH:MM:SS time to Unix timestamp (milliseconds since 1970-01-01 UTC)"""
    try:
        # Parse date in MM/DD/YY format
        if len(date_str.split('/')[2]) == 2:
            date_obj = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%y %H:%M:%S")
        else:
            date_obj = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%Y %H:%M:%S")

        # Convert to UTC timestamp
        timestamp = date_obj.replace(tzinfo=timezone.utc).timestamp()

        # Return Unix timestamp in milliseconds (NOT FIT timestamp)
        unix_timestamp = int(timestamp * 1000)

        return unix_timestamp

    except ValueError as e:
        print(f"Error parsing date {date_str} {time_str}: {e}")
        return None

def convert_pounds_to_kg(pounds):
    """Convert pounds to kilograms"""
    return round(pounds / 2.2046, 1)

def get_week_number_from_filename(filename):
    """Extract week number from filename like weight-2025-05-15.json"""
    # Remove path and extension
    base_name = filename.split('/')[-1].replace('.json', '')
    # Split by hyphen: weight-YYYY-MM-DD
    parts = base_name.split('-')
    if len(parts) >= 4:
        year = int(parts[1])
        month = int(parts[2])
        day = int(parts[3])

        # Calculate week number
        date_obj = datetime(year, month, day)
        week_number = date_obj.isocalendar()[1]

        return f"{week_number}-{year}"
    return None

def create_fit_file_from_json(json_file, output_dir="."):
    """Convert a JSON weight file to FIT format"""

    print(f"Processing {json_file}...")

    # Load JSON data
    with open(json_file, 'r') as f:
        data = json.load(f)

    if not data:
        print(f"  No data in {json_file}, skipping")
        return None

    # Get week number for filename
    week_year = get_week_number_from_filename(json_file)
    if not week_year:
        print(f"  Could not determine week number from {json_file}")
        return None

    # Create FIT file builder
    builder = FitFileBuilder(auto_define=True, min_string_size=50)

    # Add File ID message
    file_id_msg = FileIdMessage()
    file_id_msg.type = 4  # WEIGHT file type
    file_id_msg.manufacturer = 255  # FITBIT_ID
    file_id_msg.product = 1
    file_id_msg.product_name = "Health Sync"
    file_id_msg.serial_number = 1701
    file_id_msg.number = 0  # Add missing number field from template

    # Use the first entry's timestamp for file creation time
    first_entry = data[0]
    creation_timestamp = convert_date_to_unix_timestamp(first_entry['date'], first_entry['time'])
    if creation_timestamp:
        file_id_msg.time_created = creation_timestamp

    builder.add(file_id_msg)

    # Process each weight entry
    weight_entries = []
    for entry in data:
        # Convert timestamp
        unix_timestamp = convert_date_to_unix_timestamp(entry['date'], entry['time'])
        if not unix_timestamp:
            continue

        # Convert weight to kg
        weight_kg = convert_pounds_to_kg(entry['weight'])

        # Get body fat percentage if available
        body_fat = entry.get('fat', 0.0)
        if body_fat == 0.0:
            body_fat = None
        else:
            body_fat = round(body_fat, 1)

        # Create weight scale message - CRITICAL: Field order must match template exactly
        weight_msg = WeightScaleMessage()
        weight_msg.timestamp = unix_timestamp
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
    try:
        fit_file = builder.build()
        output_filename = f"Weight {week_year} Fitbit.fit"
        output_path = f"{output_dir}/{output_filename}"

        # Save the file
        fit_file.to_file(output_path)

        print(f"  Created {output_filename} with {len(weight_entries)} weight entries")
        return output_path

    except Exception as e:
        print(f"  Error creating FIT file: {e}")
        return None

def main():
    # Find all JSON weight files
    json_files = sorted(glob.glob('weight-*.json'))
    print(f"Found {len(json_files)} JSON files to convert to FIT format")

    created_files = []

    for json_file in json_files:
        output_path = create_fit_file_from_json(json_file)
        if output_path:
            created_files.append(output_path)

    print(f"\nConversion complete! Created {len(created_files)} FIT files")

if __name__ == "__main__":
    main()