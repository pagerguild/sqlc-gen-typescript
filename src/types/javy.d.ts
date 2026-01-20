/**
 * Type declarations for the Javy WASM runtime's fs module.
 * https://github.com/bytecodealliance/javy
 *
 * This module is provided by the Javy runtime at execution time,
 * not as an npm package. These declarations allow TypeScript to
 * understand the module's exports.
 */

declare module "javy/fs" {
  export const STDIO: {
    Stdin: number;
    Stdout: number;
    Stderr: number;
  };
  export function readFileSync(fd: number): Uint8Array;
  export function writeFileSync(fd: number, data: Uint8Array): void;
}
