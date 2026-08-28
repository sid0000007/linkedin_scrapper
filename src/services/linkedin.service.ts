import { LinkedInClient } from '../linkedin/client';
import { SDUI_COMPONENT_IDS } from '../linkedin/endpoints';

export interface ProfileRawSources {
  me: unknown;
  profilePage: string;
  experience: string;
  educationAndCertifications: string;
  languagesAndOrganizations: string;
}

export interface ProfileDataSource {
  getProfileSources(publicIdentifier: string): Promise<ProfileRawSources>;
}

export class LinkedInService implements ProfileDataSource {
  constructor(private readonly client: LinkedInClient = new LinkedInClient()) {}

  async getProfileSources(publicIdentifier: string): Promise<ProfileRawSources> {
    const [me, profilePage, experience, educationAndCertifications, languagesAndOrganizations] = await Promise.all([
      this.client.getMe(),
      this.client.getProfilePage(publicIdentifier),
      this.client.getComponent(SDUI_COMPONENT_IDS.experience, publicIdentifier),
      this.client.getComponent(SDUI_COMPONENT_IDS.educationAndCertifications, publicIdentifier),
      this.client.getComponent(SDUI_COMPONENT_IDS.languagesAndOrganizations, publicIdentifier),
    ]);

    return { me, profilePage, experience, educationAndCertifications, languagesAndOrganizations };
  }
}

export const linkedinService = new LinkedInService();
