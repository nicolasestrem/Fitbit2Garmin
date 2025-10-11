/**
 * @file Heart Rate measurement page - coming soon.
 * This page uses the ComingSoon component to indicate that the feature is not yet available.
 */

import React from 'react';
import { ComingSoon } from '../../components/ComingSoon';

/**
 * Renders the "coming soon" page for the heart rate measurement feature.
 * @returns {React.ReactElement} The rendered page component.
 */
export default function HeartRatePage() {
  return <ComingSoon measurementSlug="heart-rate" />;
}