import { describe, it, expect } from 'vitest';
import { getSeoCopy } from '../src/utils/seoCopy';

describe('seoCopy', () => {
  it('should return default SEO content for invalid measurement slug', () => {
    // @ts-expect-error - Testing invalid input handling
    const seoContent = getSeoCopy('non-existent-slug');
    expect(seoContent).toBeDefined();
    expect(seoContent.title).toContain('Unsupported Measurement');
  });
});