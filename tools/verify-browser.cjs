#!/usr/bin/env node
/* Compatibility entry point. The guided suite includes the previous
 * desktop/mobile, detail-dialog, image geometry and persistence coverage.
 * Source-studio UI assertions were retired with that step.
 */
require('./verify-guided-browser.cjs').run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
