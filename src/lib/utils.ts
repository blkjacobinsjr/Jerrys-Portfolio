/** shadcn's cn() for the copied registry components, without the Tailwind merge (no Tailwind here). */
export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
