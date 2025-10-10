import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@garmin/fitsdk', () => {
  const messages = [];

  class MockEncoder {
    writeMesg(msg) {
      messages.push(msg);
    }

    close() {
      return new Uint8Array([1, 2, 3]);
    }
  }

  class MockStream {}

  const profile = {
    MesgNum: {
      FILE_ID: 'FILE_ID',
      WEIGHT_SCALE: 'WEIGHT_SCALE'
    }
  };

  return {
    __esModule: true,
    default: {
      Encoder: MockEncoder,
      Stream: MockStream,
      Profile: profile
    },
    Encoder: MockEncoder,
    Stream: MockStream,
    Profile: profile,
    __getWrittenMessages: () => messages,
    __resetMessages: () => {
      messages.length = 0;
    }
  };
});

import { convertFitbitToGarmin } from '../../api/fit-converter';
import { __getWrittenMessages, __resetMessages } from '@garmin/fitsdk';

describe('fit-converter weight encoding', () => {
  beforeEach(() => {
    __resetMessages();
  });

  it('encodes kilogram weights using FIT scale 100', async () => {
    const jsonData = [
      {
        logId: 1710720000000,
        weight: 88.7,
        date: '03/18/24',
        time: '06:30:00'
      }
    ];

    await convertFitbitToGarmin([[
      'weight-2024-03-18.json',
      jsonData
    ]]);

    const weightMessage = __getWrittenMessages().find(msg => msg.mesgNum === 'WEIGHT_SCALE');
    expect(weightMessage).toBeDefined();
    expect(weightMessage.weight).toBe(8870);
  });

  it('converts pounds to kilograms and applies FIT scale 100', async () => {
    const jsonData = [
      {
        logId: 1710720000000,
        weight: 195.6,
        date: '03/18/24',
        time: '06:30:00'
      }
    ];

    await convertFitbitToGarmin([[
      'weight-2024-03-18.json',
      jsonData
    ]]);

    const weightMessage = __getWrittenMessages().find(msg => msg.mesgNum === 'WEIGHT_SCALE');
    expect(weightMessage).toBeDefined();
    expect(weightMessage.weight).toBe(8870);
  });
});
