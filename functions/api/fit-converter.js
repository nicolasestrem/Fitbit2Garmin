/**
 * FIT file converter using Garmin's official JavaScript SDK
 * Mirrors the exact logic from backend/converter.py
 *
 * This implementation uses the official @garmin/fitsdk to ensure
 * proper binary format, CRC calculations, and message structure.
 */

// Import the official Garmin FIT SDK
const FitSDK = require('@garmin/fitsdk');
const { MesgNum } = FitSDK.Profile;

class FitbitConverter {
  constructor() {
    this.conversionCount = 0;
  }

  /**
   * Convert pounds to kilograms - exact same logic as Python
   */
  convertPoundsToKg(pounds) {
    return Math.round((pounds / 2.2046) * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Extract week number from Google Takeout filename - exact same logic as Python
   */
  extractWeekYearFromFilename(filename) {
    try {
      // Remove extension and split
      const baseName = filename.replace('.json', '');
      const parts = baseName.split('-');

      if (parts.length >= 4 && parts[0] === 'weight') {
        const year = parseInt(parts[1]);
        const month = parseInt(parts[2]);
        const day = parseInt(parts[3]);

        // Calculate week number - using ISO week calculation
        const date = new Date(year, month - 1, day);
        const weekNumber = this.getISOWeekNumber(date);

        return `${weekNumber}-${year}`;
      }
    } catch (error) {
      console.warn('Could not extract date from filename:', filename);
    }
    return null;
  }

  /**
   * Get ISO week number - matching Python's isocalendar()[1]
   */
  getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Validate Google Takeout format - exact same logic as Python
   */
  validateGoogleTakeoutFormat(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return false;
    }

    // Check first entry for required fields
    const firstEntry = data[0];
    const requiredFields = ['logId', 'weight', 'date', 'time'];

    return requiredFields.every(field => field in firstEntry);
  }

  /**
   * Process JSON data and return FIT file bytes - mirrors Python exactly
   */
  processJsonData(jsonData, filename) {
    if (!this.validateGoogleTakeoutFormat(jsonData)) {
      throw new Error('Invalid Google Takeout format. Expected weight data with logId, weight, date, time fields.');
    }

    // Get week number for filename
    let weekYear = this.extractWeekYearFromFilename(filename);
    if (!weekYear) {
      // Fallback: use first entry date - exact same logic as Python
      try {
        const firstEntry = jsonData[0];
        const dateParts = firstEntry.date.split('/');
        const month = parseInt(dateParts[0]);
        const day = parseInt(dateParts[1]);
        const year = parseInt('20' + dateParts[2]); // Convert 24 to 2024
        const dateObj = new Date(year, month - 1, day);
        const weekNumber = this.getISOWeekNumber(dateObj);
        weekYear = `${weekNumber}-${year}`;
      } catch (error) {
        weekYear = "1-2025"; // Default fallback
      }
    }

    // Create FIT file encoder using official SDK
    const encoder = new FitSDK.Encoder();
    const fitData = [];

    // Capture encoded data using FitSDK Stream
    const stream = new FitSDK.Stream();
    stream.onData = (data) => {
      fitData.push(...Array.from(data));
    };

    encoder.pipe(stream);

    // Add File ID message - exact same logic as Python
    const fileIdMessage = {
      mesgNum: MesgNum.FILE_ID,
      fields: {
        type: 4, // WEIGHT file type
        manufacturer: 255, // FITBIT_ID
        product: 1,
        serialNumber: 1701,
        number: 0, // Critical: this field was missing initially
        timeCreated: Math.floor(jsonData[0].logId / 1000), // Use first entry's logId
        productName: "Health Sync"
      }
    };

    encoder.writeMesg(fileIdMessage);

    // Process each weight entry - exact same logic as Python
    const weightEntries = [];
    for (const entry of jsonData) {
      // Use logId directly as Unix timestamp (our breakthrough fix!)
      const unixTimestamp = entry.logId;

      // Convert weight to kg
      const weightKg = this.convertPoundsToKg(entry.weight);

      // Get body fat percentage if available
      let bodyFat = entry.fat || 0.0;
      if (bodyFat === 0.0) {
        bodyFat = null;
      } else {
        bodyFat = Math.round(bodyFat * 10) / 10; // Round to 1 decimal
      }

      // Create weight scale message - CRITICAL: Field order must match template exactly
      const weightMsg = {
        mesgNum: MesgNum.WEIGHT_SCALE,
        fields: {
          timestamp: Math.floor(unixTimestamp / 1000), // Unix timestamp in seconds (breakthrough fix!)
          weight: weightKg * 100, // Weight in grams (scale factor 100)
          boneMass: 0, // Set to 0 as in sample - FIELD ORDER CRITICAL
          muscleMass: 0, // Set to 0 as in sample - FIELD ORDER CRITICAL
          percentHydration: 0.0 // Set to 0 as in sample - MUST be last
        }
      };

      // percent_fat MUST come after bone_mass and muscle_mass to match template
      if (bodyFat !== null) {
        weightMsg.fields.percentFat = bodyFat * 100; // Body fat percentage in 0.01% units
      }

      weightEntries.push(weightMsg);
    }

    // Sort entries by timestamp
    weightEntries.sort((a, b) => a.fields.timestamp - b.fields.timestamp);

    // Add all weight entries
    for (const weightMsg of weightEntries) {
      encoder.writeMesg(weightMsg);
    }

    // Close the encoder to finalize the file
    encoder.close();

    // Get the encoded FIT file bytes
    const fitBytes = new Uint8Array(fitData);

    this.conversionCount++;

    return {
      fitBytes,
      entryCount: weightEntries.length,
      filename: this.getOutputFilename(filename)
    };
  }

  /**
   * Generate output filename - exact same logic as Python
   */
  getOutputFilename(inputFilename) {
    const weekYear = this.extractWeekYearFromFilename(inputFilename);
    if (weekYear) {
      return `Weight ${weekYear} Fitbit.fit`;
    }
    return 'Weight Converted Fitbit.fit';
  }
}

/**
 * Convert multiple Fitbit JSON files to Garmin FIT format
 * This mirrors convert_fitbit_to_garmin() from Python exactly
 */
function convertFitbitToGarmin(jsonFiles) {
  const converter = new FitbitConverter();
  const results = [];

  for (const [filename, jsonData] of jsonFiles) {
    try {
      const result = converter.processJsonData(jsonData, filename);
      results.push([result.filename, result.fitBytes]);

      console.log(`Converted ${filename}: ${result.entryCount} weight entries → ${result.filename}`);
    } catch (error) {
      console.error(`Failed to convert ${filename}: ${error.message}`);
      throw error;
    }
  }

  return results;
}

module.exports = { convertFitbitToGarmin };