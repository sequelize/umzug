import * as typeFest from 'type-fest';

/**
 * Create a type that has mutually exclusive keys.
 * Wrapper for @see `import('type-fest').MergeExclusive` that works for three types
 */
export type MergeExclusive<A, B, C, D> = typeFest.MergeExclusive<
	A,
	typeFest.MergeExclusive<B, typeFest.MergeExclusive<C, D>>
>;

export type MergeExclusive3<A, B, C> = typeFest.MergeExclusive<A, typeFest.MergeExclusive<B, C>>;

// export type MergeExclusive<Array extends unknown[] & {length: 3 | 4}> = Array extends [infer A, infer B, infer C] ?
