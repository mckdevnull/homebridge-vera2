// Cross-platform replacement for `rimraf ./dist` so `npm run build` works the
// same on Windows, macOS and Linux without an extra dependency.
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
