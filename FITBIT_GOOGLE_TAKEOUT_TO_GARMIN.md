# Fitbit Google Takeout to Garmin Converter - Technical Documentation

## Problem Statement

When users migrate from Fitbit to Garmin devices, they lose all their historical health data. While Garmin Connect can import some data formats, Fitbit's proprietary export formats are incompatible with Garmin's .fit file standard.

## The Breakthrough Discovery

### Critical Issue: Timestamp Format Mismatch

After extensive debugging, we discovered the root cause of import failures:

**The Problem**: Our initial implementation used FIT timestamps (milliseconds since 1989-12-31), but Garmin Connect expects **Unix timestamps** (milliseconds since 1970-01-01).

**The Evidence**:
- Working template file: timestamps like `1756820304000` → 2025-09-02 (Unix format)
- Our generated files: timestamps like `1126602806000` → 2025-09-12 (FIT format, 20 years offset)
- Files imported "successfully" but data was invisible due to timestamp mismatch

**The Fix**: Use Unix timestamps directly in the `timestamp` field of WeightScaleMessage.

```python
# WRONG (FIT timestamp)
fit_epoch = datetime(1989, 12, 31, 0, 0, 0, tzinfo=timezone.utc).timestamp()
fit_timestamp = int((timestamp - fit_epoch) * 1000)

# CORRECT (Unix timestamp)
unix_timestamp = int(timestamp * 1000)
```

## Google Takeout Format Analysis

### File Structure
Google Takeout Fitbit exports contain weight data in:
```
Takeout/Fitbit/Global Export Data/weight-YYYY-MM-DD.json
```

### JSON Format
Each file contains an array of weight measurements:
```json
[{
  "logId": 1757668406000,
  "weight": 198.1,
  "bmi": 30.04,
  "fat": 28.743999481201172,
  "date": "09/12/25",
  "time": "09:13:26",
  "source": "Aria"
}, ...]
```

### Key Fields
- `logId`: Unix timestamp (already in correct format!)
- `weight`: Weight in pounds (needs conversion to kg)
- `fat`: Body fat percentage (optional)
- `date`/`time`: Human-readable format (for validation)
- `source`: Device source (typically "Aria")

## Technical Implementation

### Required Dependencies
```
fit-tool==0.9.13
bitstruct==8.11.1
openpyxl==2.5.12
```

### Core Conversion Logic

1. **Parse JSON**: Load weight data from Google Takeout files
2. **Convert Units**: Pounds to kilograms (`weight / 2.2046`)
3. **Use Unix Timestamps**: Direct use of `logId` values
4. **Create FIT Structure**:
   - FileIdMessage (type=4 for WEIGHT, manufacturer=255 for FITBIT)
   - WeightScaleMessage for each measurement
5. **Generate Output**: Week-based naming (`Weight WW-YYYY Fitbit.fit`)

### Critical Message Structure

**FileIdMessage Requirements**:
```python
file_id_msg.type = 4  # WEIGHT file type
file_id_msg.manufacturer = 255  # FITBIT_ID
file_id_msg.product = 1
file_id_msg.product_name = "Health Sync"
file_id_msg.serial_number = 1701
file_id_msg.number = 0  # Critical: this field was missing initially
file_id_msg.time_created = unix_timestamp  # Unix format
```

**WeightScaleMessage Field Order** (order matters!):
```python
weight_msg.timestamp = unix_timestamp  # Unix format
weight_msg.weight = weight_kg
weight_msg.bone_mass = 0.0
weight_msg.muscle_mass = 0.0
weight_msg.percent_fat = body_fat_percentage  # if available
weight_msg.percent_hydration = 0.0
```

## Validation & Testing

### Test Case: March 2022 Success
- **Input**: `weight-2022-03-02.json` (14 entries)
- **Output**: `Weight 9-2022 Fitbit.fit`
- **Result**: ✅ Data appeared correctly in Garmin Connect
- **Date Range**: March 3-6, 2022 (no conflicts with existing data)

### Garmin Connect Behavior
- **Data Priority**: Garmin's own manual entries override imported data for same dates
- **Import Success**: Files marked as "imported successfully" even with timestamp issues
- **Display Logic**: Only correctly timestamped data appears in charts/timeline

## Production Results

Successfully converted **71 JSON files** covering **12+ years of weight data** (2013-2025):
- 2013: 8 entries
- 2018-2019: 151 entries
- 2020-2021: 138 entries
- 2022: 123 entries
- 2023: 126 entries
- 2024: 85 entries
- 2025: 169 entries

**Total**: 800+ weight measurements successfully migrated

## Key Lessons

1. **Timestamp Format is Critical**: Unix vs FIT epoch makes data invisible vs visible
2. **Field Order Matters**: fit-tool library is sensitive to field assignment order
3. **Missing Fields Break Import**: Even optional fields like `number` can cause failures
4. **Garmin Prioritizes Own Data**: Historical data imports work best
5. **Import Success ≠ Data Visibility**: Technical validation needed beyond "import successful"

## Web Application Requirements

### Core Features for Google Takeout Support
1. **File Upload**: Accept `weight-YYYY-MM-DD.json` files from Global Export Data
2. **Format Validation**: Verify Google Takeout JSON structure
3. **Batch Processing**: Handle multiple months of data
4. **Unix Timestamp Preservation**: Use `logId` values directly
5. **Rate Limiting**: Prevent abuse with fingerprinting

### Monetization Strategy
- **Free Tier**: 2 file conversions per day
- **Paid Tiers**: Bulk processing for complete historical migration
- **Value Proposition**: Proven working solution for 12+ years of data

This breakthrough enables thousands of users to successfully migrate their Fitbit weight history to Garmin Connect devices.