// Current raw-pixel texture pipeline; historical canvas-based evidence retains its original identity.
import fs from'node:fs/promises';
import{texturePipelineChecks}from'./texture-pipeline-checks.mjs';
const results=await texturePipelineChecks();await fs.writeFile(new URL('../../.local-tools/texture-pipeline-smoke-results.json',import.meta.url),JSON.stringify({scope:'raw-pixel-texture-pipeline-targeted',result:'pass',...results},null,2)+'\n');
console.log('Texture pipeline passed: five tiny PNGs, tick interpolation, raw uploads/gutters and owned cache/failure cleanup. No GPU/browser pass claimed.');
