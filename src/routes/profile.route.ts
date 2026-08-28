import type { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { createProfileController } from '../controllers/profile.controller';
import { profileService as defaultProfileService, type ProfileService } from '../services/profile.service';

export function buildProfileRoutes(profileService: ProfileService = defaultProfileService) {
  return async function profileRoutes(app: FastifyInstance): Promise<void> {
    app.post('/profile', { onRequest: apiKeyAuth }, createProfileController(profileService));
  };
}
