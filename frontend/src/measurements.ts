/**
 * Measurements registry - central source of truth for all measurement types
 */

export type MeasurementSlug =
  | 'weight'
  | 'heart-rate'
  | 'body-fat'
  | 'bmi'
  | 'steps'
  | 'sleep'
  | 'vo2max'
  | 'hydration'
  | 'blood-pressure'
  | 'resting-heart-rate';

export interface Measurement {
  slug: MeasurementSlug;
  label: string;
  status: 'live' | 'soon';
}

export const MEASUREMENTS: Array<Measurement> = [
  { slug: 'weight', label: 'Weight', status: 'live' },
  { slug: 'heart-rate', label: 'Heart Rate', status: 'soon' },
  { slug: 'body-fat', label: 'Body Fat', status: 'soon' },
  { slug: 'bmi', label: 'BMI', status: 'soon' },
  { slug: 'steps', label: 'Steps', status: 'soon' },
  { slug: 'sleep', label: 'Sleep', status: 'soon' },
  { slug: 'vo2max', label: 'VO2 Max', status: 'soon' },
  { slug: 'hydration', label: 'Hydration', status: 'soon' },
  { slug: 'blood-pressure', label: 'Blood Pressure', status: 'soon' },
  { slug: 'resting-heart-rate', label: 'Resting HR', status: 'soon' }
];

/**
 * Get measurement by slug
 */
export function getMeasurement(slug: MeasurementSlug): Measurement | undefined {
  return MEASUREMENTS.find(m => m.slug === slug);
}

/**
 * Get all measurements with live status first
 */
export function getMeasurementsSorted(): Array<Measurement> {
  return [...MEASUREMENTS].sort((a, b) => {
    if (a.status === 'live' && b.status === 'soon') return -1;
    if (a.status === 'soon' && b.status === 'live') return 1;
    return 0;
  });
}