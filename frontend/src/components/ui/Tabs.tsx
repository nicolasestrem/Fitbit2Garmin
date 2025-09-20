/**
 * Accessible tabs component with keyboard navigation and mobile select fallback
 */

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MEASUREMENTS, type MeasurementSlug } from '../../measurements';
import styles from './Tabs.module.css';

interface TabsProps {
  activeTab: MeasurementSlug;
  basePath?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  activeTab,
  basePath = '/measurements'
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabListRef = useRef<HTMLDivElement>(null);
  const [focusedTab, setFocusedTab] = useState<number>(-1);

  const activeIndex = MEASUREMENTS.findIndex(m => m.slug === activeTab);

  const handleTabClick = (measurement: MeasurementSlug) => {
    navigate(`${basePath}/${measurement}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    const currentIndex = activeIndex;

    switch (key) {
      case 'ArrowLeft':
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : MEASUREMENTS.length - 1;
        setFocusedTab(prevIndex);
        navigate(`${basePath}/${MEASUREMENTS[prevIndex].slug}`);
        break;

      case 'ArrowRight':
        event.preventDefault();
        const nextIndex = currentIndex < MEASUREMENTS.length - 1 ? currentIndex + 1 : 0;
        setFocusedTab(nextIndex);
        navigate(`${basePath}/${MEASUREMENTS[nextIndex].slug}`);
        break;

      case 'Home':
        event.preventDefault();
        setFocusedTab(0);
        navigate(`${basePath}/${MEASUREMENTS[0].slug}`);
        break;

      case 'End':
        event.preventDefault();
        const lastIndex = MEASUREMENTS.length - 1;
        setFocusedTab(lastIndex);
        navigate(`${basePath}/${MEASUREMENTS[lastIndex].slug}`);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedTab >= 0) {
          navigate(`${basePath}/${MEASUREMENTS[focusedTab].slug}`);
        }
        break;
    }
  };

  // Focus management for keyboard navigation
  useEffect(() => {
    if (focusedTab >= 0 && tabListRef.current) {
      const tabButton = tabListRef.current.children[focusedTab] as HTMLButtonElement;
      if (tabButton) {
        tabButton.focus();
      }
    }
  }, [focusedTab]);

  // Reset focused tab when route changes
  useEffect(() => {
    setFocusedTab(-1);
  }, [location.pathname]);

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
            className={styles.tab}
            aria-selected={measurement.slug === activeTab}
            aria-controls={`tabpanel-${measurement.slug}`}
            id={`tab-${measurement.slug}`}
            tabIndex={measurement.slug === activeTab ? 0 : -1}
            onClick={() => handleTabClick(measurement.slug)}
            onFocus={() => setFocusedTab(index)}
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
        onChange={(e) => handleTabClick(e.target.value as MeasurementSlug)}
        aria-label="Select measurement type"
      >
        {MEASUREMENTS.map((measurement) => (
          <option key={measurement.slug} value={measurement.slug}>
            {measurement.label} ({measurement.status === 'live' ? 'Live' : 'Coming Soon'})
          </option>
        ))}
      </select>
    </div>
  );
};