/**
 * SEO content generator for measurement pages
 */

import type { MeasurementSlug } from '../measurements';

export interface SEOContent {
  title: string;
  description: string;
  h1: string;
  paragraphs: string[];
  faq: Array<{ q: string; a: string }>;
}

/**
 * Generate SEO content for a measurement type
 */
export function getSeoCopy(slug: MeasurementSlug): SEOContent {
  const contentMap: Record<MeasurementSlug, SEOContent> = {
    'weight': {
      title: 'Import Weight from Fitbit to Garmin | Google Takeout Converter',
      description: 'Convert your Fitbit weight data from Google Takeout to Garmin-compatible .fit files. Seamlessly migrate years of weight history to Garmin Connect.',
      h1: 'Import Weight from Fitbit to Garmin',
      paragraphs: [
        'Convert your Fitbit weight measurements to Garmin Connect using our proven Google Takeout converter.',
        'Upload your weight-YYYY-MM-DD.json files and get Garmin-compatible .fit files ready for import.'
      ],
      faq: [
        {
          q: 'How do I get my Fitbit weight data?',
          a: 'Use Google Takeout to download your Fitbit data. Look for weight-YYYY-MM-DD.json files in the Global Export Data folder.'
        },
        {
          q: 'Will this work with Garmin Connect?',
          a: 'Yes, our converter generates .fit files that are fully compatible with Garmin Connect import.'
        },
        {
          q: 'Can I convert multiple years of data?',
          a: 'Absolutely. You can upload up to 3 files at once and convert years of historical weight data.'
        }
      ]
    },
    'heart-rate': {
      title: 'Import Heart Rate from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit heart rate data from Google Takeout to Garmin .fit files. Migrate continuous heart rate monitoring and zones to Garmin Connect.',
      h1: 'Import Heart Rate from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Soon you\'ll be able to convert your Fitbit heart rate data including resting heart rate, heart rate zones, and continuous monitoring.',
        'This will support both daily averages and detailed intraday heart rate measurements from your Fitbit device.',
        'Heart rate data will be converted to Garmin\'s native format preserving timestamps and accuracy for seamless integration.'
      ],
      faq: [
        {
          q: 'What heart rate data will be supported?',
          a: 'We plan to support resting heart rate, heart rate zones, and continuous monitoring data from Fitbit Google Takeout exports.'
        },
        {
          q: 'Will intraday heart rate data be included?',
          a: 'Yes, detailed minute-by-minute heart rate data will be converted when available in your Fitbit export.'
        },
        {
          q: 'How accurate will the heart rate zone mapping be?',
          a: 'Heart rate zones will be mapped to equivalent Garmin zones based on your age and fitness profile data.'
        }
      ]
    },
    'body-fat': {
      title: 'Import Body Fat from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit body fat percentage data from Google Takeout to Garmin .fit files. Migrate body composition tracking to Garmin Connect.',
      h1: 'Import Body Fat from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Convert your Fitbit Aria scale body fat measurements to Garmin Connect format.',
        'This feature will preserve all your body composition tracking history including fat percentage trends.',
        'Body fat data will integrate seamlessly with Garmin\'s health metrics and trend analysis.'
      ],
      faq: [
        {
          q: 'Do I need a Fitbit Aria scale for this data?',
          a: 'Body fat data is typically collected by Fitbit Aria smart scales, but any body fat entries in your Fitbit account will be supported.'
        },
        {
          q: 'Will body fat trends transfer correctly?',
          a: 'Yes, historical body fat percentage data will maintain timestamps and trends for accurate progress tracking in Garmin Connect.'
        },
        {
          q: 'How does this integrate with weight data?',
          a: 'Body fat data complements weight measurements and will be synchronized with corresponding weight entries when available.'
        }
      ]
    },
    'bmi': {
      title: 'Import BMI from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit BMI calculations from Google Takeout to Garmin .fit files. Migrate body mass index tracking to Garmin Connect.',
      h1: 'Import BMI from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Transfer your Fitbit BMI calculations and tracking history to Garmin Connect.',
        'BMI data will be converted along with the underlying height and weight measurements for complete accuracy.',
        'This ensures your health metrics dashboard in Garmin Connect has complete historical context.'
      ],
      faq: [
        {
          q: 'Is BMI calculated automatically?',
          a: 'BMI will be calculated from your height and weight data, or imported directly if present in your Fitbit export.'
        },
        {
          q: 'Will BMI categories transfer correctly?',
          a: 'Yes, BMI values will be preserved allowing Garmin Connect to display proper health category classifications.'
        },
        {
          q: 'Can I import BMI without weight data?',
          a: 'BMI data can be imported independently, though it\'s most useful when combined with weight and height measurements.'
        }
      ]
    },
    'steps': {
      title: 'Import Steps from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit daily steps data from Google Takeout to Garmin .fit files. Migrate step counting history and goals to Garmin Connect.',
      h1: 'Import Steps from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Migrate years of daily step counts from your Fitbit device to Garmin Connect.',
        'This will include daily totals, step goals, and achievement badges to maintain your activity history.',
        'Hourly step breakdowns will also be supported where available in your Google Takeout data.'
      ],
      faq: [
        {
          q: 'Will step goals transfer over?',
          a: 'Daily step totals will transfer, and you can set equivalent goals in Garmin Connect to maintain continuity.'
        },
        {
          q: 'How detailed is the step data?',
          a: 'We plan to support both daily totals and hourly breakdowns when available in your Fitbit export.'
        },
        {
          q: 'Will this affect my current Garmin step count?',
          a: 'Historical Fitbit data will be imported for past dates only, without affecting current or future Garmin device tracking.'
        }
      ]
    },
    'sleep': {
      title: 'Import Sleep from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit sleep tracking data from Google Takeout to Garmin .fit files. Migrate sleep stages, duration, and quality metrics to Garmin Connect.',
      h1: 'Import Sleep from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Transfer comprehensive sleep data including sleep stages (deep, light, REM), duration, and sleep quality metrics.',
        'Sleep efficiency scores and sleep patterns will be converted to Garmin\'s sleep tracking format.',
        'This preserves years of sleep insights and trends for continuous health monitoring.'
      ],
      faq: [
        {
          q: 'Will sleep stages be preserved accurately?',
          a: 'Yes, deep sleep, light sleep, and REM stages will be mapped to equivalent Garmin sleep stage classifications.'
        },
        {
          q: 'What about sleep quality scores?',
          a: 'Sleep efficiency and quality metrics will be converted to maintain trend analysis in Garmin Connect.'
        },
        {
          q: 'Can I import years of sleep data?',
          a: 'Absolutely. All historical sleep data from your Google Takeout export can be migrated to preserve long-term sleep patterns.'
        }
      ]
    },
    'vo2max': {
      title: 'Import VO2 Max from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit cardio fitness (VO2 Max) data from Google Takeout to Garmin .fit files. Migrate fitness level tracking to Garmin Connect.',
      h1: 'Import VO2 Max from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Migrate your Fitbit cardio fitness score (VO2 Max estimates) to Garmin Connect.',
        'This preserves your fitness level tracking and allows for continuous monitoring of cardiovascular improvements.',
        'VO2 Max trends will help maintain context for your training and fitness goals in Garmin Connect.'
      ],
      faq: [
        {
          q: 'How is Fitbit cardio fitness converted to VO2 Max?',
          a: 'Fitbit\'s cardio fitness scores will be mapped to equivalent VO2 Max values using established conversion algorithms.'
        },
        {
          q: 'Will fitness level categories transfer?',
          a: 'Yes, fitness level classifications (poor, fair, good, excellent) will be preserved for consistency.'
        },
        {
          q: 'Can this data influence Garmin training recommendations?',
          a: 'Imported VO2 Max data will integrate with Garmin\'s training features to provide appropriate workout recommendations.'
        }
      ]
    },
    'hydration': {
      title: 'Import Hydration from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit water intake tracking from Google Takeout to Garmin .fit files. Migrate hydration logging to Garmin Connect.',
      h1: 'Import Hydration from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Transfer your water intake logging and hydration tracking from Fitbit to Garmin Connect.',
        'Daily water consumption goals and achievements will be preserved to maintain your hydration habits.',
        'This includes both manual water logging and any smart water bottle integrations from your Fitbit account.'
      ],
      faq: [
        {
          q: 'Will daily water intake goals transfer?',
          a: 'Daily hydration totals will transfer, and you can set similar goals in Garmin Connect to maintain your routine.'
        },
        {
          q: 'What units are supported for water intake?',
          a: 'Both metric (liters/ml) and imperial (cups/ounces) units will be supported and converted as needed.'
        },
        {
          q: 'Can I import hydration reminders?',
          a: 'While specific reminders don\'t transfer, your historical logging patterns will help you establish similar reminders in Garmin Connect.'
        }
      ]
    },
    'blood-pressure': {
      title: 'Import Blood Pressure from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit blood pressure readings from Google Takeout to Garmin .fit files. Migrate cardiovascular health tracking to Garmin Connect.',
      h1: 'Import Blood Pressure from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Migrate blood pressure readings including systolic and diastolic measurements from Fitbit to Garmin Connect.',
        'This feature will preserve the complete cardiovascular health picture including measurement trends and timestamps.',
        'Blood pressure data will integrate with Garmin\'s health dashboard for comprehensive health monitoring.'
      ],
      faq: [
        {
          q: 'Will both systolic and diastolic readings transfer?',
          a: 'Yes, complete blood pressure readings including both systolic and diastolic values will be preserved.'
        },
        {
          q: 'How are blood pressure trends maintained?',
          a: 'All historical measurements with timestamps will transfer, allowing Garmin Connect to display accurate trend analysis.'
        },
        {
          q: 'Can I import readings from connected devices?',
          a: 'Any blood pressure data logged in your Fitbit account will be supported, regardless of the measurement device.'
        }
      ]
    },
    'resting-heart-rate': {
      title: 'Import Resting Heart Rate from Fitbit to Garmin | Google Takeout — Coming Soon',
      description: 'Convert Fitbit resting heart rate data from Google Takeout to Garmin .fit files. Migrate daily RHR tracking to Garmin Connect.',
      h1: 'Import Resting Heart Rate from Fitbit to Garmin — coming soon',
      paragraphs: [
        'Transfer your daily resting heart rate measurements from Fitbit to Garmin Connect.',
        'This preserves your cardiovascular fitness baseline and enables continued trend monitoring.',
        'Resting heart rate data will integrate with Garmin\'s fitness age and recovery metrics for comprehensive health insights.'
      ],
      faq: [
        {
          q: 'How accurate is resting heart rate conversion?',
          a: 'Daily resting heart rate values will be transferred exactly as recorded, maintaining measurement accuracy.'
        },
        {
          q: 'Will RHR trends affect Garmin fitness metrics?',
          a: 'Yes, historical resting heart rate data will contribute to Garmin\'s fitness age and recovery calculations.'
        },
        {
          q: 'Can I see long-term RHR improvements?',
          a: 'Absolutely. Years of resting heart rate data will preserve your cardiovascular fitness improvements over time.'
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