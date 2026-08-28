import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';

const API_KEY_HEADER = 'x-api-key';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const provided = request.headers[API_KEY_HEADER];
  const expected = env.API_KEY;

  const isValid = !!expected && typeof provided === 'string' && safeCompare(provided, expected);

  if (!isValid) {
    reply.code(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API key.',
        requestId: request.id,
      },
    });
  }
}
