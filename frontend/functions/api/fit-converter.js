/**
 * FIT file converter using Garmin's official JavaScript SDK
 * Mirrors the exact logic from backend/converter.py
 *
 * This implementation uses the official @garmin/fitsdk to ensure
 * proper binary format, CRC calculations, and message structure.
 */

// Defer importing the Garmin FIT SDK until runtime to avoid build-time ESM/CJS issues
let MesgNum;
let FitEncoder;
let FitStream;

async function ensureFitSdk() {
  if (MesgNum && FitEncoder && FitStream) return;
  const mod = await import('@garmin/fitsdk');
  const ns = mod.default ? mod.default : mod;
  // Support both namespace and named exports
  const Profile = ns.Profile || mod.Profile;
  MesgNum = Profile?.MesgNum || (Profile && Profile.MesgNum);
  FitEncoder = ns.Encoder || mod.Encoder;
  FitStream = ns.Stream || mod.Stream;
  if (!MesgNum || !FitEncoder || !FitStream) {
    throw new Error('Garmin FIT SDK not available in this environment');
  }
}

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
  async processJsonData(jsonData, filename) {
    await ensureFitSdk();
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

    // Create FIT file encoder using official SDK (no streams; encoder returns Uint8Array)
    const encoder = new FitEncoder();

    // Add File ID message - exact same logic as Python
    const firstTsMs = this.getUnixMs(jsonData[0]);
    const fileIdMessage = {
      mesgNum: MesgNum.FILE_ID,
      type: 4, // WEIGHT file type
      manufacturer: 255, // FITBIT_ID
      product: 1,
      serialNumber: 1701,
      number: 0,
      timeCreated: new Date(firstTsMs), // JS Date; SDK encodes to FIT time
      productName: "Health Sync"
    };

    encoder.writeMesg(fileIdMessage);

    // Process each weight entry - exact same logic as Python
    const weightEntries = [];
    for (const entry of jsonData) {
      const tsMs = this.getUnixMs(entry);

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
        timestamp: new Date(tsMs),
        weight: weightKg, // SDK applies scale=100 automatically
        boneMass: 0.0,
        muscleMass: 0.0,
        percentHydration: 0.0,
        ...(bodyFat !== null ? { percentFat: bodyFat } : {})
      };

      weightEntries.push(weightMsg);
    }

    // Sort entries by timestamp
    weightEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Add all weight entries
    for (const weightMsg of weightEntries) {
      encoder.writeMesg(weightMsg);
    }

    // Close the encoder to finalize the file and get bytes
    const fitBytes = encoder.close();

    this.conversionCount++;

    return {
      fitBytes,
      entryCount: weightEntries.length,
      filename: this.getOutputFilename(filename)
    };
  }

  getUnixMs(entry) {
    // Prefer explicit logId if present and looks like ms since epoch
    if (entry?.logId && typeof entry.logId === 'number' && entry.logId > 1e12) {
      return entry.logId;
    }
    // Fallback: parse date/time fields (MM/DD/YY and HH:MM:SS)
    try {
      const { date, time } = entry;
      const parts = date.split('/');
      const year = parts[2].length === 2 ? Number('20' + parts[2]) : Number(parts[2]);
      const month = Number(parts[0]);
      const day = Number(parts[1]);
      const [hh, mm, ss] = (time || '00:00:00').split(':').map(Number);
      const dt = new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
      return dt.getTime();
    } catch {
      // As a last resort, use now
      return Date.now();
    }
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
async function convertFitbitToGarmin(jsonFiles) {
  const converter = new FitbitConverter();
  const results = [];

  for (const [filename, jsonData] of jsonFiles) {
    try {
      const result = await converter.processJsonData(jsonData, filename);
      results.push([result.filename, result.fitBytes]);

      console.log(`Converted ${filename}: ${result.entryCount} weight entries → ${result.filename}`);
    } catch (error) {
      console.error(`Failed to convert ${filename}: ${error.message}`);
      throw error;
    }
  }

  return results;
}

export { convertFitbitToGarmin };
