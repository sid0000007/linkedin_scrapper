import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFlightResponse } from '../../src/flight/flight-parser';
import { parseHtmlTopCard, parseProfileTopCard } from '../../src/parsers/profile.parser';
import { parseExperience } from '../../src/parsers/experience.parser';
import { parseEducation } from '../../src/parsers/education.parser';
import { parseSkills } from '../../src/parsers/skills.parser';
import { parseCertifications } from '../../src/parsers/certifications.parser';
import { parseLanguages } from '../../src/parsers/languages.parser';
import { normalizeProfile } from '../../src/normalizer/profile.normalizer';
import { ProfileSchema } from '../../src/models/profile.types';
import meFixture from '../fixtures/me-response.sample.json';
import meMinimalFixture from '../fixtures/me-response.minimal.json';

const EXPERIENCE_SYNTHETIC = readFileSync(new URL('../fixtures/flight/experience-response.synthetic.txt', import.meta.url), 'utf-8');
const EDU_CERT_SYNTHETIC = readFileSync(
  new URL('../fixtures/flight/education-certifications-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const LANGUAGES_SYNTHETIC = readFileSync(
  new URL('../fixtures/flight/languages-organizations-response.synthetic.txt', import.meta.url),
  'utf-8',
);
const TOPCARD_HTML_REAL = readFileSync(new URL('../fixtures/topcard-page.real.html', import.meta.url), 'utf-8');
const EMPTY_FLIGHT_BODY = '0:["$","div",null,{"children":[]}]\n';

/**
 * Full pipeline, one hop at a time, exactly as ProfileService wires it in production: raw
 * sources -> Flight-stream resolution / HTML extraction -> per-section parsers ->
 * normalizer -> schema-validated Profile. Snapshotted so any unintentional shape/field-name
 * drift shows up as a diff here, even if the more granular per-parser/per-normalizer tests
 * still pass.
 */
function runPipeline(
  me: unknown,
  profilePageHtml: string,
  experienceBody: string,
  eduCertBody: string,
  languagesBody: string,
  url: string,
) {
  const experienceTree = parseFlightResponse(experienceBody);
  const eduCertTree = parseFlightResponse(eduCertBody);
  const languagesTree = parseFlightResponse(languagesBody);

  const meTopCard = parseProfileTopCard(me);
  const htmlTopCard = parseHtmlTopCard(profilePageHtml);

  const profile = normalizeProfile(
    {
      topCard: {
        ...meTopCard,
        fullName: htmlTopCard.fullName,
        headline: htmlTopCard.headline ?? meTopCard.headline,
        location: htmlTopCard.location,
      },
      experience: parseExperience(experienceTree),
      education: parseEducation(eduCertTree),
      skills: parseSkills(),
      certifications: parseCertifications(eduCertTree),
      languages: parseLanguages(languagesTree),
    },
    url,
  );

  return ProfileSchema.parse(profile);
}

describe('full pipeline (raw sources -> Flight parser / HTML extraction -> domain parsers -> normalizer -> schema)', () => {
  it('produces the expected Profile shape for fully-populated sources, including the real captured top-card HTML', () => {
    // Deliberately pairs the synthetic /me fixture (Jordan Rivera) with the real HTML
    // fixture (Siddharth Gupta) to exercise the merge override itself: fullName/headline/
    // location should come from HTML even though firstName/lastName/image come from /me.
    const profile = runPipeline(
      meFixture,
      TOPCARD_HTML_REAL,
      EXPERIENCE_SYNTHETIC,
      EDU_CERT_SYNTHETIC,
      LANGUAGES_SYNTHETIC,
      'https://www.linkedin.com/in/siddharthgupta007/',
    );

    expect(profile).toMatchSnapshot();
  });

  it('produces the expected Profile shape for minimal/empty sources without throwing', () => {
    const profile = runPipeline(
      meMinimalFixture,
      '<html><body>no topcard</body></html>',
      EMPTY_FLIGHT_BODY,
      EMPTY_FLIGHT_BODY,
      EMPTY_FLIGHT_BODY,
      'https://www.linkedin.com/in/alex-chen/',
    );

    expect(profile).toMatchSnapshot();
  });
});
