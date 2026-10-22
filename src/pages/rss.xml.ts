import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { published, WRITING } from '../lib/writing';

export const GET: APIRoute = async ({ site }) =>
  rss({
    title: WRITING.title,
    description: WRITING.description,
    site: site!,
    items: (await published()).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/writing/${post.id}/`,
    })),
  });
