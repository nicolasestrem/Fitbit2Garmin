/**
 * @file Accessible tabs component with keyboard navigation and mobile select fallback.
 * This component renders a set of tabs for navigating between different measurement types.
 * It supports WAI-ARIA practices for tabs, including keyboard navigation.
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MEASUREMENTS, type MeasurementSlug } from '../../measurements';
import styles from './Tabs.module.css';

/**
 * @interface TabsProps
 * @description Props for the Tabs component.
 * @property {MeasurementSlug} activeTab - The slug of the currently active tab.
 * @property {string} [basePath='/measurements'] - The base path for the tab routes.
 */
interface TabsProps {
  activeTab: MeasurementSlug;
  basePath?: string;
}

/**
 * A React component that provides an accessible tab navigation system.
 * It includes keyboard support for arrow keys, home, and end, and falls back
 * to a select dropdown on smaller screens.
 * @param {TabsProps} props - The component props.
 * @returns {React.ReactElement} The rendered tabs component.
 */
export const Tabs: React.FC<TabsProps> = ({
  activeTab,
  basePath = '/measurements'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabListRef = useRef<HTMLDivElement>(null);
  const [focusedTab, setFocusedTab] = useState<number>(-1);

  const activeIndex = MEASUREMENTS.findIndex(m => m.slug === activeTab);

  /**
   * Handles the click event on a tab. Navigates to the corresponding route
   * if the tab is not disabled.
   * @param {MeasurementSlug} measurement - The slug of the clicked measurement.
   * @param {'live' | 'soon'} status - The status of the measurement.
   */
  const handleTabClick = (measurement: MeasurementSlug, status: 'live' | 'soon') => {
    if (status === 'soon') return;
    navigate(`${basePath}/${measurement}`);
  };

  /**
   * Handles keyboard navigation for the tab list, implementing WAI-ARIA patterns.
   * Supports ArrowLeft, ArrowRight, Home, End, Enter, and Space keys.
   * @param {KeyboardEvent<HTMLDivElement>} event - The keyboard event.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    const currentIndex = activeIndex;

    switch (key) {
      case 'ArrowLeft': {
        event.preventDefault();
        let prevIndex = currentIndex > 0 ? currentIndex - 1 : MEASUREMENTS.length - 1;
        while (MEASUREMENTS[prevIndex].status === 'soon' && prevIndex !== currentIndex) {
          prevIndex = prevIndex > 0 ? prevIndex - 1 : MEASUREMENTS.length - 1;
        }
        if (MEASUREMENTS[prevIndex].status === 'live') {
          setFocusedTab(prevIndex);
          navigate(`${basePath}/${MEASUREMENTS[prevIndex].slug}`);
        }
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        let nextIndex = currentIndex < MEASUREMENTS.length - 1 ? currentIndex + 1 : 0;
        while (MEASUREMENTS[nextIndex].status === 'soon' && nextIndex !== currentIndex) {
          nextIndex = nextIndex < MEASUREMENTS.length - 1 ? nextIndex + 1 : 0;
        }
        if (MEASUREMENTS[nextIndex].status === 'live') {
          setFocusedTab(nextIndex);
          navigate(`${basePath}/${MEASUREMENTS[nextIndex].slug}`);
        }
        break;
      }
      case 'Home': {
        event.preventDefault();
        const firstLiveIndex = MEASUREMENTS.findIndex(m => m.status === 'live');
        if (firstLiveIndex !== -1) {
          setFocusedTab(firstLiveIndex);
          navigate(`${basePath}/${MEASUREMENTS[firstLiveIndex].slug}`);
        }
        break;
      }
      case 'End': {
        event.preventDefault();
        const lastLiveIndex = MEASUREMENTS.length - 1 - [...MEASUREMENTS].reverse().findIndex(m => m.status === 'live');
        if (lastLiveIndex >= 0) {
          setFocusedTab(lastLiveIndex);
          navigate(`${basePath}/${MEASUREMENTS[lastLiveIndex].slug}`);
        }
        break;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedTab >= 0) {
          navigate(`${basePath}/${MEASUREMENTS[focusedTab].slug}`);
        }
        break;
    }
  };

  /**
   * Effect hook to manage focus on tab buttons during keyboard navigation.
   */
  useEffect(() => {
    if (focusedTab >= 0 && tabListRef.current) {
      const tabButton = tabListRef.current.children[focusedTab] as HTMLButtonElement;
      if (tabButton) {
        tabButton.focus();
      }
    }
  }, [focusedTab]);

  /**
   * Effect hook to reset the focused tab index when the route changes.
   */
  useEffect(() => {
    setFocusedTab(-1);
  }, [location.pathname]);

  /**
   * A small badge component to display the status ('live' or 'soon') of a tab.
   * @param {{ status: 'live' | 'soon' }} props - The props for the component.
   * @returns {React.ReactElement} The rendered status badge.
   */
  const StatusBadge: React.FC<{ status: 'live' | 'soon' }> = ({ status }) => (
    <span
      className={`${styles.badge} ${status === 'live' ? styles.badgeLive : styles.badgeSoon}`}
      aria-label={status === 'live' ? 'Available now' : 'Coming soon'}
    >
      {status === 'live' ? 'Live' : 'Soon'}
    </span>
  );

  return (
    <div>
      {/* Desktop Tabs */}
      <div
        role="tablist"
        className={styles.tabList}
        ref={tabListRef}
        onKeyDown={handleKeyDown}
        aria-label="Measurement types"
      >
        {MEASUREMENTS.map((measurement, index) => (
          <button
            key={measurement.slug}
            role="tab"
            className={`${styles.tab} ${measurement.status === 'soon' ? styles.tabDisabled : ''}`}
            aria-selected={measurement.slug === activeTab}
            aria-controls={`tabpanel-${measurement.slug}`}
            id={`tab-${measurement.slug}`}
            tabIndex={measurement.slug === activeTab ? 0 : -1}
            onClick={() => handleTabClick(measurement.slug, measurement.status)}
            onFocus={() => setFocusedTab(index)}
            disabled={measurement.status === 'soon'}
            aria-disabled={measurement.status === 'soon'}
          >
            {measurement.label}
            <StatusBadge status={measurement.status} />
          </button>
        ))}
      </div>

      {/* Mobile Select Fallback */}
      <select
        className={styles.mobileSelect}
        value={activeTab}
        onChange={(e) => {
          const selectedMeasurement = MEASUREMENTS.find(m => m.slug === e.target.value);
          if (selectedMeasurement) {
            handleTabClick(e.target.value as MeasurementSlug, selectedMeasurement.status);
          }
        }}
        aria-label="Select measurement type"
      >
        {MEASUREMENTS.map((measurement) => (
          <option
            key={measurement.slug}
            value={measurement.slug}
            disabled={measurement.status === 'soon'}
          >
            {measurement.label} ({measurement.status === 'live' ? 'Live' : 'Coming Soon'})
          </option>
        ))}
      </select>
    </div>
  );
};