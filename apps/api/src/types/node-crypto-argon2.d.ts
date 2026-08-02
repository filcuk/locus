/**
 * Ambient types for `node:crypto` Argon2 (Node ≥24.7).
 * `@types/node` 22 in the tree predates these exports.
 */
declare module 'node:crypto' {
  export type Argon2Algorithm = 'argon2d' | 'argon2i' | 'argon2id';

  export interface Argon2Parameters {
    message: string | NodeJS.ArrayBufferView;
    nonce: string | NodeJS.ArrayBufferView;
    parallelism: number;
    tagLength: number;
    memory: number;
    passes: number;
    secret?: string | NodeJS.ArrayBufferView;
    associatedData?: string | NodeJS.ArrayBufferView;
  }

  export function argon2(
    algorithm: Argon2Algorithm,
    parameters: Argon2Parameters,
    callback: (err: Error | null, derivedKey?: Buffer) => void,
  ): void;

  export function argon2Sync(
    algorithm: Argon2Algorithm,
    parameters: Argon2Parameters,
  ): Buffer;
}
