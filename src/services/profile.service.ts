import { extractPublicIdentifier } from '../utils/url.util';
import { linkedinService, type ProfileDataSource } from './linkedin.service';
import { parseFlightResponse } from '../flight/flight-parser';
import { parseProfileTopCard, parseHtmlTopCard } from '../parsers/profile.parser';
import { parseExperience } from '../parsers/experience.parser';
import { parseEducation } from '../parsers/education.parser';
import { parseSkills } from '../parsers/skills.parser';
import { parseCertifications } from '../parsers/certifications.parser';
import { parseLanguages } from '../parsers/languages.parser';
import { normalizeProfile } from '../normalizer/profile.normalizer';
import type { Profile } from '../models/profile.types';

export class ProfileService {
  constructor(private readonly dataSource: ProfileDataSource = linkedinService) {}

  async getProfile(url: string): Promise<Profile> {
    const publicIdentifier = extractPublicIdentifier(url);
    const sources = await this.dataSource.getProfileSources(publicIdentifier);

    const experienceTree = parseFlightResponse(sources.experience);
    const educationAndCertificationsTree = parseFlightResponse(sources.educationAndCertifications);
    const languagesAndOrganizationsTree = parseFlightResponse(sources.languagesAndOrganizations);

    // `/me` (self-view only) gives a clean firstName/lastName split and sized images; the
    // profile page HTML (works for any profile) gives headline/location generally. Merge,
    // preferring the general source where both could apply.
    const meTopCard = parseProfileTopCard(sources.me);
    const htmlTopCard = parseHtmlTopCard(sources.profilePage);

    return normalizeProfile(
      {
        topCard: {
          ...meTopCard,
          fullName: htmlTopCard.fullName,
          headline: htmlTopCard.headline ?? meTopCard.headline,
          location: htmlTopCard.location,
        },
        experience: parseExperience(experienceTree),
        education: parseEducation(educationAndCertificationsTree),
        skills: parseSkills(),
        certifications: parseCertifications(educationAndCertificationsTree),
        languages: parseLanguages(languagesAndOrganizationsTree),
      },
      url,
    );
  }
}

export const profileService = new ProfileService();
