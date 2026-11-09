import type { APIRoute } from 'astro';
import { asc, desc, eq, and, or, ilike } from 'drizzle-orm';
import { db, services } from '../../db';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const layer = url.searchParams.get('layer'); // build | grow | run
    const discipline = url.searchParams.get('discipline');
    const q = url.searchParams.get('q')?.trim();

    const conditions = [];

    if (layer && ['build', 'grow', 'run'].includes(layer.toLowerCase())) {
      conditions.push(eq(services.layer, layer.toLowerCase()));
    }

    if (discipline) {
      conditions.push(eq(services.discipline, discipline));
    }

    if (q) {
      conditions.push(
        or(
          ilike(services.name, `%${q}%`),
          ilike(services.description, `%${q}%`),
          ilike(services.discipline, `%${q}%`),
          ilike(services.code, `%${q}%`)
        )
      );
    }

    const items = await db
      .select()
      .from(services)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(services.code), asc(services.name));

    return new Response(
      JSON.stringify({
        services: items,
        total: items.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      }
    );
  } catch (error: any) {
    console.error('API services GET error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch services' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
