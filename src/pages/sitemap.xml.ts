import type { APIRoute } from 'astro';
import { published } from '../lib/writing';

const PAGES = ['/', '/writing', '/consultancy', '/contact'];

export const GET: APIRoute = async ({ site }) => {
  const paths = [...PAGES, ...(await published()).map((post) => `/writing/${post.id}`)];
  const urls = paths.map((path) => `<url><loc>${new URL(path, site)}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
