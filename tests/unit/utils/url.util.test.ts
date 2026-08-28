import { describe, expect, it } from 'vitest';
import { extractPublicIdentifier } from '../../../src/utils/url.util';
import { InvalidLinkedInUrlError } from '../../../src/errors/linkedin.errors';

describe('extractPublicIdentifier', () => {
  it.each([
    ['https://www.linkedin.com/in/john-doe/', 'john-doe'],
    ['https://linkedin.com/in/john-doe', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe?trk=public_profile', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe/details/experience/', 'john-doe'],
  ])('extracts the public identifier from %s', (url, expected) => {
    expect(extractPublicIdentifier(url)).toBe(expected);
  });

  it.each([
    'https://www.linkedin.com/company/example/',
    'https://www.linkedin.com/jobs/view/12345/',
    'https://www.linkedin.com/posts/john-doe_activity-123/',
    'https://www.linkedin.com/school/example-university/',
    'https://example.com/in/john-doe/',
    'not-a-url',
  ])('rejects %s', (url) => {
    expect(() => extractPublicIdentifier(url)).toThrow(InvalidLinkedInUrlError);
  });
});
