/** What the /contact letter is about: the Re :: line. */
export const TOPICS = ['A new product', 'Consultancy', 'Just a hello'] as const;
export type Topic = (typeof TOPICS)[number];

export interface LetterFields {
  topic: Topic;
  from: string;
  body: string;
  name: string;
}

/** The letter goes out through the visitor's own mail app: the site has no form backend. */
export function mailto(email: string, { topic, from, body, name }: LetterFields): string {
  const signed = name.trim();
  const reply = from.trim();
  const subject = signed ? `${topic}, from ${signed}` : topic;
  const text = `Dear Jerry,\n\n${body.trim()}\n\nSincerely,\n${signed || 'A visitor'}${reply ? `\n${reply}` : ''}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** Hand the letter to the mail app. One path for the send button and the torn stub, so they cannot differ. */
export function openMail(url: string, doc: Document = document): void {
  const link = doc.createElement('a');
  link.href = url;
  doc.body.append(link);
  link.click();
  link.remove();
}

/** A blank sheet as an image, the texture the crumple overlay folds while the live letter is hidden. */
export function sheetImage(width: number, height: number, fill: string): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
