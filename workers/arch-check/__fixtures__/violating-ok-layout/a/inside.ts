// ❌ This is the violating file: it reaches into "b" through an internal
// file instead of going through b/api.ts. The arch-check worker must
// flag this with a `boundary violation`.
import { bSecret } from "../b/internal/foo";
export const leak = () => bSecret;
