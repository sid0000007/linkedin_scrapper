import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { ProfileService } from '../services/profile.service';

const ProfileRequestBodySchema = z.object({
  url: z.string().url(),
});

export function createProfileController(profileService: ProfileService) {
  return async function getProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { url } = ProfileRequestBodySchema.parse(request.body);
    const profile = await profileService.getProfile(url);
    reply.send(profile);
  };
}
