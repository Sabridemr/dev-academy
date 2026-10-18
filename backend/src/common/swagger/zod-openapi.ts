import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodObject, ZodRawShape, ZodSchema } from 'zod';

/**
 * Zod şemasından OpenAPI gövde dokümantasyonu üretir. Böylece DTO'lar yalnızca
 * shared paketinde zod olarak tanımlanır; OpenAPI ve doğrulama aynı kaynaktan beslenir.
 */
// zod-to-json-schema'nın derin generic tipleri TS2589'a yol açtığı için gevşek imza kullanıyoruz.
const toJsonSchema = zodToJsonSchema as unknown as (
  schema: unknown,
  options: Record<string, unknown>,
) => Record<string, unknown>;

export function ApiZodBody(schema: ZodSchema, description?: string) {
  const jsonSchema = toJsonSchema(schema, { $refStrategy: 'none', target: 'openApi3' });
  delete jsonSchema.$schema;
  return applyDecorators(ApiBody({ schema: jsonSchema as never, description }));
}

/** Zod obje şemasındaki her alanı ayrı bir query parametresi olarak belgeler. */
export function ApiZodQuery(schema: ZodObject<ZodRawShape>) {
  const jsonSchema = toJsonSchema(schema, { $refStrategy: 'none', target: 'openApi3' }) as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  const decorators = Object.entries(jsonSchema.properties ?? {}).map(([name, prop]) =>
    ApiQuery({
      name,
      required: jsonSchema.required?.includes(name) ?? false,
      schema: prop as never,
    }),
  );
  return applyDecorators(...decorators);
}
