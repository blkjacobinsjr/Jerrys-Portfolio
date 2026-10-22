import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'writing'>;

/** Published posts, newest first. Drafts never reach the list, a page or the feed. */
export async function published(): Promise<Post[]> {
  const posts = await getCollection('writing', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export const WRITING = {
  title: 'Writing, Jerry Doughan',
  description: 'Notes from Jerry Doughan on product design, frontend craft and building with AI.',
};
