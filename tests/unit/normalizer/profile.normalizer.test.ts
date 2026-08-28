import { describe, expect, it } from 'vitest';
import { normalizeProfile, type ParsedProfileSections } from '../../../src/normalizer/profile.normalizer';
import { ProfileSchema } from '../../../src/models/profile.types';

const fullSections: ParsedProfileSections = {
  topCard: {
    firstName: 'Jordan',
    lastName: 'Rivera',
    headline: 'Senior Software Engineer at Example Corp',
    publicIdentifier: 'jordan-rivera-example',
    image: { url: 'https://example.com/scale_400_400/a', width: 400, height: 400 },
    backgroundImage: undefined,
  },
  experience: [
    {
      title: 'Staff Engineer',
      companyName: 'Acme Corp · Full-time',
      dateRangeText: 'Jan 2023 - Present · 2 yrs',
      location: 'Remote',
      description: 'Shipped things.',
    },
  ],
  education: [{ schoolName: 'State University', degreeName: 'B.S. Computer Science' }],
  skills: [],
  certifications: [{ name: 'Cloud Practitioner', authority: 'AWS', issuedText: 'Issued Jan 2023', credentialIdText: 'Credential ID XYZ' }],
  languages: [],
};

const emptySections: ParsedProfileSections = {
  topCard: { firstName: 'Alex', lastName: 'Chen', headline: 'Product Manager', publicIdentifier: 'alex-chen' },
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
};

describe('normalizeProfile', () => {
  it('produces a fully populated, schema-valid profile', () => {
    const profile = normalizeProfile(fullSections, 'https://www.linkedin.com/in/jordan-rivera-example/');

    expect(() => ProfileSchema.parse(profile)).not.toThrow();
    expect(profile.name).toEqual({ firstName: 'Jordan', lastName: 'Rivera', fullName: 'Jordan Rivera' });
    expect(profile.headline).toBe('Senior Software Engineer at Example Corp');
    expect(profile.image?.url).toContain('scale_400_400');

    expect(profile.experience).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp · Full-time',
        location: 'Remote',
        description: 'Shipped things.',
        startDate: 'Jan 2023',
        endDate: undefined,
      },
    ]);

    expect(profile.education).toEqual([{ school: 'State University', degree: 'B.S. Computer Science' }]);

    expect(profile.certifications).toEqual([
      { name: 'Cloud Practitioner', issuingOrganization: 'AWS', issueDate: 'Jan 2023' },
    ]);
  });

  it('degrades to empty sections without throwing', () => {
    const profile = normalizeProfile(emptySections, 'https://www.linkedin.com/in/alex-chen/');

    expect(() => ProfileSchema.parse(profile)).not.toThrow();
    expect(profile.name).toEqual({ firstName: 'Alex', lastName: 'Chen', fullName: 'Alex Chen' });
    expect(profile.headline).toBe('Product Manager');
    expect(profile.location).toBeUndefined();
    expect(profile.about).toBeUndefined();
    expect(profile.image).toBeUndefined();
    expect(profile.experience).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.certifications).toEqual([]);
    expect(profile.languages).toEqual([]);
  });

  it('rejects a malformed object via ProfileSchema (proves real validation, not just typing)', () => {
    const malformed = { url: 'https://example.com', name: {}, experience: 'not-an-array' };

    expect(() => ProfileSchema.parse(malformed)).toThrow();
  });
});
