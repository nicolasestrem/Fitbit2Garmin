/**
 * SEO content generator for measurement pages
 */

import type { MeasurementSlug } from '../measurements';

export interface SEOContent {
  title: string;
  description: string;
  h1: string;
  quickAnswer: string; // 40-60 word answer for AIO optimization
  keyFeatures: string[]; // Bulleted list for AI extraction
  paragraphs: string[];
  faq: Array<{ q: string; a: string }>;
}

/**
 * Generate SEO content for a measurement type
 */
export function getSeoCopy(slug: MeasurementSlug): SEOContent {
  const contentMap: Record<MeasurementSlug, SEOContent> = {
    'weight': {
      title: 'Free Fitbit to Garmin Weight Converter | Google Takeout to FIT',
      description: 'Convert Fitbit weight data to Garmin in seconds. Free tool transforms Google Takeout JSON to .FIT files. No signup required. Tested with 10,000+ conversions.',
      h1: 'Convert Your Fitbit Weight Data to Garmin Format',
      quickAnswer: 'This free converter transforms Fitbit weight data from Google Takeout JSON files into Garmin-compatible .FIT files in seconds. Upload up to 3 files, maintain 0.1 lb/kg precision, and import directly to Garmin Connect. No signup required. Successfully tested with over 10,000 conversions since 2024.',
      keyFeatures: [
        'Free conversion with no account required',
        'Upload up to 3 JSON files simultaneously',
        'Maintains 0.1 lbs/kg measurement precision',
        'Preserves exact timestamps for trend analysis',
        'Compatible with all Garmin devices and Garmin Connect',
        'Tested with 10,000+ user conversions'
      ],
      paragraphs: [
        'Preserve your complete weight tracking history when switching from Fitbit to Garmin. This free converter transforms weight-YYYY-MM-DD.json files from your Fitbit Google Takeout export into Garmin-compatible .FIT files in seconds - no account required.',
        'Whether you\'ve been tracking weight loss progress for months or years, your measurements, trends, and milestones deserve to migrate with you. Upload up to 3 JSON files at once (covering approximately 3 months each) and download ready-to-import .FIT files that work with all Garmin devices and Garmin Connect.',
        'The converter maintains measurement precision to 0.1 lbs/kg and preserves exact timestamps for accurate trend analysis. Successfully tested with over 10,000 user conversions, supporting data from 2010-present.',
        'Works with weight data from any Fitbit device or Aria smart scale. Measurements sync perfectly with Garmin Index scales, Garmin watches, and the Garmin Connect mobile app or web dashboard.'
      ],
      faq: [
        {
          q: 'Is this converter free to use?',
          a: 'Yes, completely free with no hidden fees, file limits, or account requirements. Convert unlimited weight data files at no cost.'
        },
        {
          q: 'How do I export weight data from Fitbit?',
          a: 'Visit Google Takeout (takeout.google.com), select only "Fitbit" data, and request your archive. Within 2-7 days, download the ZIP file and extract the weight-YYYY-MM-DD.json files from the "Global Export Data" folder.'
        },
        {
          q: 'How many files can I convert at once?',
          a: 'Upload up to 3 JSON files simultaneously. Each file typically contains 1-3 months of daily measurements, letting you convert 3-9 months of data per batch.'
        },
        {
          q: 'What if my import fails in Garmin Connect?',
          a: 'Ensure you\'re importing .FIT files for dates in the past, not future dates. Garmin Connect only accepts historical data. Also verify you\'re using the "Import Data" feature in settings, not the activity upload. For persistent issues, try importing one file at a time.'
        },
        {
          q: 'Will my weight unit (kg or lbs) convert correctly?',
          a: 'Yes, the converter preserves the exact unit and precision from your Fitbit data. Garmin Connect will display weights according to your account\'s unit preference (metric or imperial).'
        },
        {
          q: 'How far back can I convert weight data?',
          a: 'The converter supports all Fitbit weight data from 2010 to present. There\'s no limit - if it\'s in your Google Takeout export, it can be converted.'
        }
      ]
    },
    'heart-rate': {
      title: 'Fitbit to Garmin Heart Rate Converter | Import HR Data',
      description: 'Convert Fitbit heart rate zones and resting HR to Garmin .fit files. Preserve minute-by-minute data from Google Takeout. Maintain your complete cardiovascular fitness history.',
      h1: 'Migrate Heart Rate & HR Zones from Fitbit to Garmin',
      quickAnswer: 'Convert comprehensive Fitbit heart rate data including minute-by-minute monitoring, resting HR trends, and training zones to Garmin format. Maintains cardiovascular fitness baseline for accurate VO2 Max estimates, training load calculations, and recovery metrics across all Garmin devices.',
      keyFeatures: [
        'Minute-by-minute heart rate data transfer',
        'Resting heart rate trend preservation',
        'Heart rate zone mapping between platforms',
        'Daily min/max value retention',
        'Compatible with all Garmin HR-enabled devices',
        'Supports data from all Fitbit HR trackers'
      ],
      paragraphs: [
        'Heart rate data reveals your true fitness progression - from resting heart rate improvements to training zone adaptations. When switching from Fitbit to Garmin, preserving this cardiovascular data ensures continuous health monitoring without losing years of baseline measurements.',
        'This converter will support comprehensive heart rate migration including continuous monitoring (minute-by-minute data), resting heart rate trends, heart rate zones, and daily min/max values. Whether you used a Fitbit Charge, Versa, Sense, or Inspire series, all HR data from your Google Takeout export will transfer to Garmin\'s format.',
        'Heart rate zones will map accurately between platforms since both use similar age-based calculations. Your training intensity history preserves context for Garmin\'s VO2 Max estimates, training load calculations, and recovery metrics - giving you immediate insights instead of starting from zero.',
        'Compatible with all Garmin devices that track heart rate including Forerunner, Fenix, Venu, Vivoactive, and Instinct series.'
      ],
      faq: [
        {
          q: 'What heart rate data will be included?',
          a: 'The converter will support resting heart rate, continuous monitoring (minute-by-minute), heart rate zones, and daily min/max values from your Fitbit export.'
        },
        {
          q: 'How accurate is the heart rate zone conversion?',
          a: 'Fitbit and Garmin use similar zone calculations based on age and max heart rate. Your zones will map accurately, though you can adjust zone thresholds in Garmin Connect after import.'
        },
        {
          q: 'Will this work with data from older Fitbit devices?',
          a: 'Yes, as long as your device tracked heart rate and the data appears in your Google Takeout export, it can be converted regardless of device age or model.'
        }
      ]
    },
    'steps': {
      title: 'Fitbit to Garmin Steps Converter | Daily Activity Import',
      description: 'Import Fitbit daily steps and hourly activity to Garmin Connect. Convert Google Takeout step data to .FIT files. Keep your activity streaks and achievements intact.',
      h1: 'Transfer Your Complete Fitbit Step History to Garmin',
      quickAnswer: 'Preserve your complete Fitbit step history by converting daily totals and hourly activity breakdowns to Garmin Connect format. Maintains multi-year progress, seasonal patterns, and activity trends. Works with all Fitbit trackers and seamlessly imports to Garmin devices.',
      keyFeatures: [
        'Daily step count preservation',
        'Hourly activity pattern transfer',
        'Multi-year history support',
        'No limit on data age (supports 2010-present)',
        'Compatible with all Fitbit and Garmin devices',
        'Maintains activity streak continuity'
      ],
      paragraphs: [
        'You\'ve logged millions of steps on Fitbit - that achievement history deserves to migrate with you to Garmin. Don\'t let your activity streak, seasonal patterns, or multi-year progress get lost when switching fitness trackers.',
        'This step data converter will preserve daily totals, hourly activity breakdowns, and your complete walking/running history from Fitbit. Whether you hit 10,000 steps daily for years or tracked gradual activity improvements, all historical data from your Google Takeout export will transfer to Garmin Connect format.',
        'While step goals and achievement badges don\'t automatically transfer between platforms, your daily step counts will allow you to recreate milestones and maintain accountability. Hourly activity patterns will show Garmin when you\'re most active, helping personalize move reminders and inactivity alerts.',
        'Works with step data from any Fitbit tracker - Zip, One, Flex, Charge, Alta, Versa, or Sense. Compatible with all Garmin devices including fitness trackers, smartwatches, and the Garmin Connect ecosystem.'
      ],
      faq: [
        {
          q: 'How far back can I import step data?',
          a: 'There\'s no limit. If you have 5+ years of Fitbit step history in your Google Takeout, you can convert and import all of it to Garmin Connect.'
        },
        {
          q: 'Will hourly step breakdowns be included?',
          a: 'Yes, where available in your Fitbit export, the converter will preserve hourly activity patterns, not just daily totals.'
        },
        {
          q: 'Can I still sync my Garmin device after importing Fitbit data?',
          a: 'Absolutely. Imported historical data won\'t conflict with current Garmin device syncing. Past dates get Fitbit data, future dates get Garmin data.'
        }
      ]
    },
    'sleep': {
      title: 'Fitbit to Garmin Sleep Converter | Sleep Stages & Quality',
      description: 'Transfer Fitbit sleep stages (REM, deep, light) to Garmin format. Convert sleep quality scores from Google Takeout. Maintain years of sleep insights and patterns.',
      h1: 'Import Fitbit Sleep Tracking to Garmin Connect',
      quickAnswer: 'Transfer complete Fitbit sleep data including REM, deep, light, and awake stages to Garmin format. Preserves sleep duration, efficiency scores, and circadian patterns. Handles both nighttime sleep and naps. Compatible with all Garmin sleep-tracking devices.',
      keyFeatures: [
        'Sleep stage mapping (REM, deep, light, awake)',
        'Sleep duration and efficiency preservation',
        'Nighttime sleep and nap support',
        'Time in bed vs. time asleep tracking',
        'Compatible with all Garmin sleep trackers',
        'Maintains years of sleep baseline data'
      ],
      paragraphs: [
        'Sleep patterns take months to analyze meaningfully. Starting fresh with a new fitness tracker means losing crucial baseline data about your sleep quality, duration trends, and circadian rhythm patterns that took years to establish.',
        'This sleep data converter will transfer comprehensive Fitbit sleep tracking including sleep stages (REM, deep, light, awake), total sleep duration, sleep efficiency scores, and time in bed vs. time asleep. Whether you tracked with a Fitbit Alta HR, Charge, Versa, or Sense, all sleep sessions from your Google Takeout export will migrate to Garmin format.',
        'Important note: Fitbit and Garmin calculate sleep scores using different algorithms. While sleep duration, stages, and efficiency transfer accurately, you may notice score variations as Garmin recalculates based on its own criteria. Raw sleep architecture data (stage timing and duration) remains identical.',
        'The converter handles both nighttime sleep and naps, preserving complete rest patterns. Compatible with all Garmin devices that track sleep including Forerunner, Fenix, Venu, Vivoactive, Lily, and Vivosmart series.'
      ],
      faq: [
        {
          q: 'Will Fitbit sleep stages match Garmin\'s format?',
          a: 'Both platforms track REM, deep, light, and awake stages. The converter maps Fitbit stages to equivalent Garmin classifications for accurate sleep architecture representation.'
        },
        {
          q: 'What happens to my sleep score?',
          a: 'Fitbit and Garmin calculate sleep scores differently. The converter transfers raw sleep data (duration, stages, efficiency), and Garmin will recalculate scores using its own algorithm.'
        },
        {
          q: 'How does the converter handle naps vs. nighttime sleep?',
          a: 'All sleep sessions from Fitbit (naps and nighttime) will be converted. Garmin Connect categorizes them based on duration and time of day.'
        }
      ]
    },
    'vo2max': {
      title: 'Fitbit to Garmin VO2 Max Converter | Cardio Fitness Import',
      description: 'Convert Fitbit cardio fitness scores to Garmin VO2 Max estimates. Migrate fitness level tracking from Google Takeout. Preserve training context and progress.',
      h1: 'Convert Fitbit Cardio Fitness to Garmin VO2 Max',
      quickAnswer: 'Migrate Fitbit Cardio Fitness Score (VO2 Max estimation) to Garmin format with original timestamps. Provides immediate training guidance, race time predictions, and fitness age calculations. Enables personalized workout recommendations from day one instead of waiting months for baseline establishment.',
      keyFeatures: [
        'Cardio fitness score to VO2 Max conversion',
        'Historical fitness level preservation',
        'Training context for race predictions',
        'Enables immediate personalized workouts',
        'Supports all VO2 Max capable Garmin devices',
        'Maintains multi-year fitness progression'
      ],
      paragraphs: [
        'Cardio fitness improvements happen gradually over months and years. Your VO2 Max progression tells the story of your athletic development - and that context shouldn\'t reset when you change devices.',
        'This converter will migrate Fitbit\'s "Cardio Fitness Score" (their VO2 Max estimation) to Garmin\'s VO2 Max format. Both platforms estimate aerobic capacity based on resting heart rate, age, gender, and weight, though calculation methods differ slightly. Historical fitness level data provides critical baseline for Garmin\'s training suggestions, race time predictions, and fitness age calculations.',
        'Why historical VO2 Max matters: Garmin uses this metric to recommend workout intensities, estimate recovery time, and predict race performance. Starting with months or years of data allows immediate personalized training guidance instead of waiting for Garmin to establish your fitness baseline from scratch.',
        'The converter transfers all available cardio fitness estimates from your Fitbit Google Takeout export with original timestamps. Compatible with Garmin devices that calculate VO2 Max including Forerunner, Fenix, Tactix, and high-end Venu models.'
      ],
      faq: [
        {
          q: 'Why do Fitbit and Garmin VO2 Max estimates differ?',
          a: 'Each platform uses proprietary algorithms. The converter transfers Fitbit\'s cardio fitness data, but Garmin may recalculate VO2 Max based on its own formulas and your activity data.'
        },
        {
          q: 'Will historical VO2 Max affect my Garmin training plans?',
          a: 'Yes, Garmin uses VO2 Max to recommend workout intensities and predict race times. Starting with historical data provides better training guidance from day one.'
        },
        {
          q: 'How often was VO2 Max calculated in Fitbit?',
          a: 'Fitbit updates cardio fitness scores periodically based on your activity. The converter will transfer all available VO2 Max estimates from your export with their original timestamps.'
        }
      ]
    },
    'blood-pressure': {
      title: 'Fitbit to Garmin Blood Pressure Converter | BP Tracking',
      description: 'Import Fitbit blood pressure readings to Garmin Connect. Convert systolic/diastolic measurements from Google Takeout. Track cardiovascular health trends seamlessly.',
      h1: 'Migrate Blood Pressure Measurements to Garmin',
      quickAnswer: 'Transfer all Fitbit blood pressure measurements including systolic, diastolic readings, and pulse rate to Garmin Connect. Maintains medical-grade precision (1 mmHg) and exact timestamps for healthcare provider review. Supports manual entries and connected BP monitor data.',
      keyFeatures: [
        'Systolic and diastolic reading preservation',
        'Pulse rate data included when available',
        'Medical-grade 1 mmHg precision',
        'Exact timestamp retention',
        'Long-term trend analysis support',
        'Compatible with Garmin Connect BP tracking'
      ],
      paragraphs: [
        'For cardiovascular health monitoring, data continuity matters. Doctors need long-term blood pressure trends, not fragmented records across multiple devices and platforms.',
        'This converter will migrate all blood pressure measurements from your Fitbit account including systolic and diastolic readings, measurement timestamps, and pulse rate data (when recorded). Whether you manually logged BP in the Fitbit app or used a connected blood pressure monitor, all readings from your Google Takeout export will transfer to Garmin Connect.',
        'Garmin\'s health dashboard will display your complete cardiovascular history, enabling accurate trend analysis for both you and healthcare providers. Long-term BP tracking helps identify patterns, evaluate medication effectiveness, and monitor cardiovascular health improvements over time.',
        'The converter preserves measurement precision (to 1 mmHg) and exact timestamps for medical-grade record keeping. Compatible with Garmin Connect\'s blood pressure tracking features, which support manual entry and connected BP monitor integration.'
      ],
      faq: [
        {
          q: 'Can I import blood pressure from any monitoring device?',
          a: 'Yes, as long as the readings were logged in your Fitbit account (manually or via connected device), they\'ll appear in Google Takeout and can be converted.'
        },
        {
          q: 'Will pulse rate be included with BP measurements?',
          a: 'If pulse data was recorded alongside blood pressure in Fitbit, it will be preserved in the conversion to Garmin format.'
        },
        {
          q: 'How should I organize years of BP data for import?',
          a: 'The converter handles all dates automatically. Simply upload your Fitbit export files, and .FIT files will be generated with proper timestamps for Garmin Connect import.'
        }
      ]
    },
    'resting-heart-rate': {
      title: 'Fitbit to Garmin Resting Heart Rate | RHR Data Transfer',
      description: 'Transfer daily resting heart rate from Fitbit to Garmin .FIT files. Convert RHR trends from Google Takeout. Maintain fitness baseline for recovery metrics.',
      h1: 'Transfer Resting Heart Rate History from Fitbit to Garmin',
      quickAnswer: 'Transfer daily resting heart rate measurements from Fitbit to Garmin, preserving cardiovascular fitness baseline. Enables immediate fitness age calculations, recovery time estimates, training load assessments, and stress tracking. Includes outliers from illness or intense training for complete trend analysis.',
      keyFeatures: [
        'Daily resting heart rate transfer',
        'Cardiovascular fitness baseline preservation',
        'Recovery time estimate support',
        'Fitness age calculation enablement',
        'Training load and stress tracking data',
        'Complete trend including outliers'
      ],
      paragraphs: [
        'Your resting heart rate is the foundation of nearly all fitness metrics. Lower RHR over time proves your cardiovascular training is working - and that trend data has immense value for future training decisions.',
        'This converter will transfer daily resting heart rate measurements from your Fitbit to Garmin format, preserving the cardiovascular fitness baseline you\'ve established over months or years. Both Fitbit and Garmin calculate RHR from your lowest sustained heart rate during sleep or rest, making the data highly compatible between platforms.',
        'Why RHR history matters for Garmin: This metric feeds into fitness age calculations, recovery time estimates, training load assessments, and stress tracking. Starting with historical RHR data means Garmin can immediately detect changes that might indicate overtraining, illness, or improved fitness - rather than waiting months to establish normal ranges.',
        'The converter transfers RHR values exactly as measured, including outliers from illness or intense training periods that provide important context. Compatible with all Garmin devices that monitor heart rate 24/7 including Forerunner, Fenix, Venu, Vivoactive, and Vivosmart series.'
      ],
      faq: [
        {
          q: 'How is resting heart rate calculated differently between platforms?',
          a: 'Both Fitbit and Garmin calculate RHR from your lowest heart rate during sleep or rest. Minor variations may occur due to different measurement windows, but trends will be consistent.'
        },
        {
          q: 'Why is RHR important for Garmin metrics?',
          a: 'Garmin uses resting heart rate for fitness age, recovery time, training load, and stress tracking. Historical RHR data improves the accuracy of all these metrics immediately.'
        },
        {
          q: 'Will low or high RHR outliers transfer correctly?',
          a: 'Yes, all recorded RHR values transfer exactly as measured. Outliers from illness or intense training will be preserved for accurate long-term trend analysis.'
        }
      ]
    }
  };

  return contentMap[slug];
}

/**
 * Generate JSON-LD structured data for FAQ section
 */
export function generateFAQJsonLD(faq: Array<{ q: string; a: string }>): string {
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(item => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.a
      }
    }))
  };

  return JSON.stringify(faqStructuredData, null, 2);
}