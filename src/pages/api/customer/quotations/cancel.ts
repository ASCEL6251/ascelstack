import type { APIRoute } from 'astro';
import { POST as cancelHandler } from '../service-requests/cancel';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  return cancelHandler(context);
};
