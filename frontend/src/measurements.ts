/**
 * @file Measurements registry - central source of truth for all measurement types
 */

/**
 * Represents a unique identifier for a type of measurement.
 * @typedef {'weight' | 'heart-rate' | 'steps' | 'sleep' | 'vo2max' | 'blood-pressure'} MeasurementSlug
 */
export type MeasurementSlug =
  | 'weight'
  | 'heart-rate'
  | 'steps'
  | 'sleep'
  | 'vo2max'
  | 'blood-pressure';

/**
 * @interface Measurement
 * @description Represents the metadata for a type of health measurement.
 * @property {MeasurementSlug} slug - The unique identifier for the measurement.
 * @property {string} label - The human-readable name for the measurement.
 * @property {'live' | 'soon'} status - The availability status of the measurement feature.
 */
export interface Measurement {
  slug: MeasurementSlug;
  label: string;
  status: 'live' | 'soon';
}

/**
 * @constant {Array<Measurement>} MEASUREMENTS
 * @description A list of all available health measurements and their metadata.
 */
export const MEASUREMENTS: Array<Measurement> = [
  { slug: 'weight', label: 'Weight', status: 'live' },
  { slug: 'heart-rate', label: 'Heart Rate', status: 'soon' },
  { slug: 'steps', label: 'Steps', status: 'soon' },
  { slug: 'sleep', label: 'Sleep', status: 'soon' },
  { slug: 'vo2max', label: 'VO2 Max', status: 'soon' },
  { slug: 'blood-pressure', label: 'Blood Pressure', status: 'soon' },
];

/**
 * Retrieves a measurement's metadata by its slug.
 * @param {MeasurementSlug} slug - The unique identifier for the measurement.
 * @returns {Measurement | undefined} The measurement object if found, otherwise undefined.
 */
export function getMeasurement(slug: MeasurementSlug): Measurement | undefined {
  return MEASUREMENTS.find(m => m.slug === slug);
}

/**
 * Gets all measurements, sorted with 'live' status first, then alphabetically by label.
 * @returns {Array<Measurement>} A new array of sorted measurements.
 */
export function getMeasurementsSorted(): Array<Measurement> {
  return [...MEASUREMENTS].sort((a, b) => {
    if (a.status === 'live' && b.status === 'soon') return -1;
    if (a.status === 'soon' && b.status === 'live') return 1;
    return a.label.localeCompare(b.label);
  });
}