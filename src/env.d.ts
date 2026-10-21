declare module 'astro' {
  interface AstroClientDirectives {
    'client:afterload'?: boolean | string;
  }
}

export {};
