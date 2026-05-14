import type { ZodType, ZodSafeParseResult } from 'zod';

declare module 'fastify' {
  interface FastifyInstance {
    parseZodBody<T>(schema: ZodType<T>, body: unknown): ZodSafeParseResult<T>;
  }
}

export function registerZodValidation(fastify: {
  decorate: (name: string, value: unknown) => void;
}): void {
  fastify.decorate('parseZodBody', <T>(schema: ZodType<T>, body: unknown) =>
    schema.safeParse(body)
  );
}
