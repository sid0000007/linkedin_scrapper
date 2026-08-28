import { describe, expect, it } from 'vitest';
import { parseImage } from '../../../src/parsers/image.parser';

describe('parseImage', () => {
  it('picks the largest artifact and joins it onto rootUrl', () => {
    const result = parseImage({
      rootUrl: 'https://media.licdn.com/dms/image/v2/EXAMPLE/photo-',
      artifacts: [
        { width: 100, height: 100, fileIdentifyingUrlPathSegment: 'scale_100_100/a' },
        { width: 400, height: 400, fileIdentifyingUrlPathSegment: 'scale_400_400/a' },
        { width: 200, height: 200, fileIdentifyingUrlPathSegment: 'scale_200_200/a' },
      ],
    });

    expect(result).toEqual({
      url: 'https://media.licdn.com/dms/image/v2/EXAMPLE/photo-scale_400_400/a',
      width: 400,
      height: 400,
    });
  });

  it('returns undefined when the image is undefined', () => {
    expect(parseImage(undefined)).toBeUndefined();
  });

  it('returns undefined when there are no artifacts', () => {
    expect(parseImage({ rootUrl: 'https://example.com/', artifacts: [] })).toBeUndefined();
  });

  it('returns undefined when rootUrl is missing', () => {
    expect(parseImage({ artifacts: [{ width: 100, fileIdentifyingUrlPathSegment: 'x' }] })).toBeUndefined();
  });
});
