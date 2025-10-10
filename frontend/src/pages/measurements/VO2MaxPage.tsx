/**
 * @file VO2 Max measurement page - coming soon.
 * This page uses the ComingSoon component to indicate that the feature is not yet available.
 */

import React from 'react';
import { ComingSoon } from '../../components/ComingSoon';

/**
 * Renders the "coming soon" page for the VO2 Max measurement feature.
 * @returns {React.ReactElement} The rendered page component.
 */
export default function VO2MaxPage() {
  return <ComingSoon measurementSlug="vo2max" />;
}