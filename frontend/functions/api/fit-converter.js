/**
 * @file FIT file converter using Garmin's official JavaScript SDK.
 * @description This module handles the conversion of Fitbit weight data from JSON format
 * to Garmin's binary FIT format. It uses the `@garmin/fitsdk` to ensure the output
 * is compliant and can be imported into Garmin Connect.
 */

// Lazily import the Garmin FIT SDK to handle potential ESM/CJS compatibility issues at build time.
let MesgNum;
let FitEncoder;

/**
 * Ensures that the Garmin FIT SDK modules are loaded before use.
 * This is a one-time asynchronous operation.
 * @throws {Error} If the SDK cannot be loaded.
 */
async function ensureFitSdk() {
  if (MesgNum && FitEncoder) return;
  const mod = await import('@garmin/fitsdk');
  const ns = mod.default ? mod.default : mod;
  const Profile = ns.Profile || mod.Profile;
  MesgNum = Profile?.MesgNum || (Profile && Profile.MesgNum);
  FitEncoder = ns.Encoder || mod.Encoder;
  if (!MesgNum || !FitEncoder) {
    throw new Error('Garmin FIT SDK not available in this environment');
  }
}

/**
 * A class to handle the conversion of Fitbit data to FIT format.
 */
class FitbitConverter {
  constructor() {
    this.conversionCount = 0;
  }

  /**
   * Analyzes a sample of weight data to detect whether the unit is 'kg' or 'lbs'.
   * @param {Array<object>} data - An array of weight entries from the JSON file.
   * @returns {{unit: 'kg'|'lbs', confidence: string, reason: string, stats: object}} An object with the detected unit and analysis details.
   */
  detectWeightUnit(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { unit: 'lbs', confidence: 'unknown', reason: 'No data available' };
    }
    const weights = data.map(entry => entry.weight).filter(w => typeof w === 'number' && w > 0);
    if (weights.length === 0) {
      return { unit: 'lbs', confidence: 'unknown', reason: 'No valid weight values' };
    }

    const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);
    const stats = { min: minWeight, max: maxWeight, avg: avgWeight, count: weights.length };

    if (maxWeight < 200 && avgWeight < 150) {
      return { unit: 'kg', confidence: 'high', reason: `Average weight ${avgWeight.toFixed(1)}, max ${maxWeight.toFixed(1)} suggest kg`, stats };
    }
    if (minWeight > 90 && avgWeight > 150) {
      return { unit: 'lbs', confidence: 'high', reason: `Average weight ${avgWeight.toFixed(1)}, min ${minWeight.toFixed(1)} suggest lbs`, stats };
    }
    if (avgWeight >= 150 && avgWeight <= 200) {
      return { unit: 'lbs', confidence: 'medium', reason: `Ambiguous range (avg ${avgWeight.toFixed(1)}), defaulting to lbs`, stats };
    }
    return { unit: 'lbs', confidence: 'low', reason: `Unclear pattern (avg ${avgWeight.toFixed(1)}), defaulting to lbs`, stats };
  }

  /**
   * Converts a weight value from pounds to kilograms.
   * @param {number} pounds - The weight in pounds.
   * @returns {number} The weight in kilograms, rounded to one decimal place.
   */
  convertPoundsToKg(pounds) {
    return Math.round((pounds / 2.2046) * 10) / 10;
  }

  /**
   * Normalizes a weight value to kilograms based on the detected unit.
   * @param {number} weight - The weight value.
   * @param {'kg'|'lbs'} detectedUnit - The detected unit of the weight.
   * @returns {number} The weight in kilograms.
   */
  normalizeWeightToKg(weight, detectedUnit) {
    if (detectedUnit === 'kg') {
      return Math.round(weight * 10) / 10;
    }
    return this.convertPoundsToKg(weight);
  }

  /**
   * Extracts the year and ISO week number from a Google Takeout filename (e.g., 'weight-2023-12-31.json').
   * @param {string} filename - The input filename.
   * @returns {string|null} The week and year string (e.g., '52-2023') or null if not found.
   */
  extractWeekYearFromFilename(filename) {
    try {
      const baseName = filename.replace('.json', '');
      const parts = baseName.split('-');
      if (parts.length >= 4 && parts[0] === 'weight') {
        const year = parseInt(parts[1]);
        const month = parseInt(parts[2]);
        const day = parseInt(parts[3]);
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
   * Calculates the ISO 8601 week number for a given date.
   * @param {Date} date - The date object.
   * @returns {number} The ISO week number.
   */
  getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Validates if the provided data matches the expected Google Takeout format for weight.
   * @param {any} data - The parsed JSON data.
   * @returns {boolean} True if the format is valid, otherwise false.
   */
  validateGoogleTakeoutFormat(data) {
    if (!Array.isArray(data) || data.length === 0) return false;
    const firstEntry = data[0];
    const requiredFields = ['logId', 'weight', 'date', 'time'];
    return requiredFields.every(field => field in firstEntry);
  }

  /**
   * Processes a single JSON file's data and converts it into a FIT file's byte array.
   * @param {Array<object>} jsonData - The array of weight entries.
   * @param {string} filename - The original filename, used for logging and naming.
   * @returns {Promise<object>} An object containing the FIT file bytes, entry count, new filename, and unit detection details.
   */
  async processJsonData(jsonData, filename) {
    await ensureFitSdk();
    if (!this.validateGoogleTakeoutFormat(jsonData)) {
      throw new Error('Invalid Google Takeout format. Expected weight data with logId, weight, date, time fields.');
    }

    const unitDetection = this.detectWeightUnit(jsonData);
    console.log(`Unit detection for ${filename}:`, unitDetection);
    if (unitDetection.confidence === 'low' || unitDetection.confidence === 'medium') {
      console.warn(`⚠️ ${unitDetection.reason}. If weights appear incorrect, your Fitbit data may be in a different unit than expected.`);
    }

    const encoder = new FitEncoder();
    const firstTsMs = this.getUnixMs(jsonData[0]);
    encoder.writeMesg({
      mesgNum: MesgNum.FILE_ID, type: 4, manufacturer: 255, product: 1,
      serialNumber: 1701, number: 0, timeCreated: new Date(firstTsMs), productName: "Health Sync"
    });

    const weightEntries = [];
    for (const entry of jsonData) {
      const tsMs = this.getUnixMs(entry);
      const weightKg = this.normalizeWeightToKg(entry.weight, unitDetection.unit);
      let bodyFat = entry.fat || 0.0;
      bodyFat = (bodyFat === 0.0) ? null : Math.round(bodyFat * 10) / 10;
      const weightScaled = Math.round(weightKg * 100);

      weightEntries.push({
        mesgNum: MesgNum.WEIGHT_SCALE, timestamp: new Date(tsMs), weight: weightScaled,
        boneMass: 0.0, muscleMass: 0.0, percentHydration: 0.0,
        ...(bodyFat !== null ? { percentFat: bodyFat } : {})
      });
    }

    weightEntries.sort((a, b) => a.timestamp - b.timestamp);
    for (const weightMsg of weightEntries) {
      encoder.writeMesg(weightMsg);
    }

    const fitBytes = encoder.close();
    this.conversionCount++;

    return {
      fitBytes,
      entryCount: weightEntries.length,
      filename: this.getOutputFilename(filename),
      unitDetection: {
        detectedUnit: unitDetection.unit,
        confidence: unitDetection.confidence,
        reason: unitDetection.reason,
        stats: unitDetection.stats
      }
    };
  }

  /**
   * Gets a Unix timestamp in milliseconds from a weight entry.
   * It prioritizes the `logId` field if it's a valid timestamp, otherwise falls back to parsing `date` and `time`.
   * @param {object} entry - The weight entry object.
   * @returns {number} The Unix timestamp in milliseconds.
   */
  getUnixMs(entry) {
    if (entry?.logId && typeof entry.logId === 'number' && entry.logId > 1e12) {
      return entry.logId;
    }
    try {
      const { date, time } = entry;
      const parts = date.split('/');
      const year = parts[2].length === 2 ? Number('20' + parts[2]) : Number(parts[2]);
      const month = Number(parts[0]);
      const day = Number(parts[1]);
      const [hh, mm, ss] = (time || '00:00:00').split(':').map(Number);
      return new Date(Date.UTC(year, month - 1, day, hh, mm, ss)).getTime();
    } catch {
      return Date.now();
    }
  }

  /**
   * Generates a descriptive output filename for the FIT file.
   * @param {string} inputFilename - The original JSON filename.
   * @returns {string} The generated FIT filename.
   */
  getOutputFilename(inputFilename) {
    const weekYear = this.extractWeekYearFromFilename(inputFilename);
    return weekYear ? `Weight ${weekYear} Fitbit.fit` : 'Weight Converted Fitbit.fit';
  }
}

/**
 * Converts an array of Fitbit JSON file data into an array of Garmin FIT files.
 * @param {Array<[string, Array<object>]>} jsonFiles - An array of tuples, where each tuple contains a filename and its parsed JSON data.
 * @returns {Promise<Array<[string, Uint8Array, object]>>} A promise that resolves to an array of tuples,
 * each containing the new filename, the FIT file as a Uint8Array, and the unit detection info.
 */
async function convertFitbitToGarmin(jsonFiles) {
  const converter = new FitbitConverter();
  const results = [];

  for (const [filename, jsonData] of jsonFiles) {
    try {
      const result = await converter.processJsonData(jsonData, filename);
      results.push([result.filename, result.fitBytes, result.unitDetection]);
      console.log(`Converted ${filename}: ${result.entryCount} weight entries → ${result.filename}`);
      console.log(`  Unit detected: ${result.unitDetection.detectedUnit} (${result.unitDetection.confidence} confidence)`);
      console.log(`  Reason: ${result.unitDetection.reason}`);
    } catch (error) {
      console.error(`Failed to convert ${filename}: ${error.message}`);
      throw error;
    }
  }

  return results;
}

export { convertFitbitToGarmin };
