import * as typeFest from 'type-fest';

/**
 * Create a type that has mutually exclusive keys.
 * Wrapper for @see `import('type-fest').MergeExclusive` that works for three types
 */
export type MergeExclusive<A, B, C> = typeFest.MergeExclusive<A, typeFest.MergeExclusive<B, C>>;
