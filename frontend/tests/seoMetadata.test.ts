import { describe, it, expect } from 'vitest';
import { getSeoCopy } from '../src/utils/seoCopy';
import { MeasurementSlug } from '../src/measurements';

describe('seoCopy', () => {
  it('should return default SEO content for a non-existent measurement slug', () => {
    const slug = 'non-existent-slug' as MeasurementSlug;
    const seoContent = getSeoCopy(slug);
    expect(seoContent).toBeDefined();
    expect(seoContent.title).toBe('Unsupported Measurement | Body Fat % Calculator');
    expect(seoContent.description).toBe('This measurement is not yet supported.');
  });
});