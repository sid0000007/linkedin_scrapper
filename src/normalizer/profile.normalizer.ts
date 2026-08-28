import { ProfileSchema, type Profile } from '../models/profile.types';
import type { ParsedProfileTopCard } from '../parsers/profile.parser';
import type { ParsedExperience } from '../parsers/experience.parser';
import type { ParsedEducation } from '../parsers/education.parser';
import type { ParsedSkill } from '../parsers/skills.parser';
import type { ParsedCertification } from '../parsers/certifications.parser';
import type { ParsedLanguage } from '../parsers/languages.parser';
import { parseDateRangeText, parseIssuedText } from '../utils/date.util';

export interface ParsedProfileSections {
  topCard: ParsedProfileTopCard;
  experience: ParsedExperience[];
  education: ParsedEducation[];
  skills: ParsedSkill[];
  certifications: ParsedCertification[];
  languages: ParsedLanguage[];
}

/**
 * LinkedIn's location strings sometimes carry a trailing work-mode suffix — strip it
 * before the existing best-effort city/country split. See README known limitations: this
 * heuristic can still be wrong for single-word locations.
 */
function normalizeLocation(raw: string | undefined) {
  if (!raw) return undefined;

  const [geography = ''] = raw.split('·').map((part) => part.trim());

  const parts = geography
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  return {
    raw,
    city: parts[0],
    country: parts[parts.length - 1],
  };
}

function normalizeExperience(experience: ParsedExperience[]) {
  return experience.map((item) => {
    const { startDate, endDate } = parseDateRangeText(item.dateRangeText);

    return {
      title: item.title,
      company: item.companyName,
      location: item.location,
      description: item.description,
      startDate,
      endDate,
    };
  });
}

function normalizeEducation(education: ParsedEducation[]) {
  return education.map((item) => ({
    school: item.schoolName,
    degree: item.degreeName,
  }));
}

function normalizeCertifications(certifications: ParsedCertification[]) {
  return certifications.map((item) => ({
    name: item.name,
    issuingOrganization: item.authority,
    issueDate: parseIssuedText(item.issuedText),
  }));
}

export function normalizeProfile(sections: ParsedProfileSections, sourceUrl: string): Profile {
  const { topCard } = sections;
  const fullName = topCard.fullName ?? [topCard.firstName, topCard.lastName].filter(Boolean).join(' ') ?? undefined;

  const candidate: Profile = {
    url: sourceUrl,
    publicIdentifier: topCard.publicIdentifier,
    name: {
      firstName: topCard.firstName,
      lastName: topCard.lastName,
      fullName: fullName || undefined,
    },
    headline: topCard.headline,
    location: normalizeLocation(topCard.location),
    // "About" (summary) has no confirmed source yet — it's presumably another lazy
    // below-the-fold component like Experience/Education, not yet captured. See
    // docs/RESEARCH.md and README's known limitations.
    about: undefined,
    image: topCard.image ? { url: topCard.image.url } : undefined,
    backgroundImage: topCard.backgroundImage ? { url: topCard.backgroundImage.url } : undefined,
    experience: normalizeExperience(sections.experience),
    education: normalizeEducation(sections.education),
    skills: sections.skills.map((skill) => ({ name: skill.name, endorsementCount: skill.endorsementCount })),
    certifications: normalizeCertifications(sections.certifications),
    languages: sections.languages.map((language) => ({ name: language.name, proficiency: language.proficiency })),
  };

  return ProfileSchema.parse(candidate);
}
