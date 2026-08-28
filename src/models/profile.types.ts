import { z } from 'zod';

export const NameSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
});

export const LocationSchema = z.object({
  raw: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const ImageSchema = z.object({
  url: z.string(),
});

export const ExperienceSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const EducationSchema = z.object({
  school: z.string().optional(),
  degree: z.string().optional(),
});

export const SkillSchema = z.object({
  name: z.string().optional(),
  endorsementCount: z.number().optional(),
});

export const CertificationSchema = z.object({
  name: z.string().optional(),
  issuingOrganization: z.string().optional(),
  issueDate: z.string().optional(),
});

export const LanguageSchema = z.object({
  name: z.string().optional(),
  proficiency: z.string().optional(),
});

export const ProfileSchema = z.object({
  url: z.string(),
  publicIdentifier: z.string().optional(),
  name: NameSchema,
  headline: z.string().optional(),
  location: LocationSchema.optional(),
  about: z.string().optional(),
  image: ImageSchema.optional(),
  backgroundImage: ImageSchema.optional(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillSchema),
  certifications: z.array(CertificationSchema),
  languages: z.array(LanguageSchema),
});

export type Name = z.infer<typeof NameSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type ProfileImage = z.infer<typeof ImageSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
