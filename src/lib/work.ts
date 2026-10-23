import { getImage } from 'astro:assets';
import { projects, type Project } from '../data/site';

export interface Shot {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * A project-page screenshot. `texture` is the one ~1200px candidate the carousel's WebGL texture uses,
 * never the original; `full` is the widest candidate, for the lightbox.
 */
export interface Screenshot extends Shot {
  texture: string;
  full: { src: string; width: number; height: number };
}

export interface WorkItem extends Omit<Project, 'shots' | 'shotAlts' | 'phone' | 'logo'> {
  logo: string;
  shots: [Screenshot, Screenshot, Screenshot];
  phone: Shot & { avifSrcset: string };
}

/** Resolve a project's images once, for its home-page card and its own page. */
export async function resolveProject({ shots, shotAlts, phone, logo, ...project }: Project): Promise<WorkItem> {
  const resolved = await Promise.all(
    shots.map(async (src, i) => {
      const img = await getImage({ src, widths: i === 2 ? [240, 360, 480, 640] : [480, 800, 1200, 1600], format: 'webp' });
      const widest = img.srcSet.values.at(-1)!;
      const texture = img.srcSet.values.filter((v) => (v.transform.width ?? 0) <= 1200).at(-1)?.url ?? img.src;
      const width = widest.transform.width ?? src.width;
      return {
        src: img.src,
        srcset: img.srcSet.attribute,
        width: src.width,
        height: src.height,
        alt: shotAlts[i] ?? '',
        texture,
        full: { src: widest.url, width, height: Math.round((width * src.height) / src.width) },
      } satisfies Screenshot;
    }),
  );
  const mark = await getImage({ src: logo, width: 96, format: 'webp' });
  const hand = await getImage({ src: phone.src, widths: [360, 540, 720, 960], format: 'webp' });
  const handAvif = await getImage({ src: phone.src, widths: [360, 540, 720, 960], format: 'avif', quality: 58 });
  return {
    ...project,
    logo: mark.src,
    shots: resolved as WorkItem['shots'],
    phone: { src: hand.src, srcset: hand.srcSet.attribute, avifSrcset: handAvif.srcSet.attribute, width: phone.src.width, height: phone.src.height, alt: phone.alt },
  };
}

export const resolveProjects = () => Promise.all(projects.map(resolveProject));
