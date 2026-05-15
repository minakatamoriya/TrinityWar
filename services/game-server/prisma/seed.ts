import { runSeed } from '../src/seed/run-seed.js';

runSeed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
