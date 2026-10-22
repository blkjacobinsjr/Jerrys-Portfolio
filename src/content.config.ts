import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Writing: plain markdown in src/content/writing, no CMS. Drop in `my-post.md` with this
 * frontmatter and it appears on /writing, at /writing/my-post and in /rss.xml.
 * Files starting with an underscore are ignored (see _template.md).
 */
const writing = defineCollection({
  loader: glob({ base: './src/content/writing', pattern: '**/[^_]*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing };
