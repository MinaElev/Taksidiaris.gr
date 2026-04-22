// Helpers for the editable site-wide config (homepage hero etc.).
//
// Reading is sync at build time (regular JSON import) so pages that need it
// don't have to await anything. Writing is async because it goes through
// content-io's writeMd-style dispatcher (filesystem locally, GitHub commit
// on Vercel).

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { writeFileToGitHub, isVercelRuntime } from './github-content';

const ROOT = process.cwd();
const SITE_JSON = join(ROOT, 'src', 'data', 'site.json');

export interface SiteConfig {
  homeHero: string;
  homeHeroAlt: string;
}

const DEFAULTS: SiteConfig = {
  homeHero: '',
  homeHeroAlt: '',
};

export async function readSiteConfig(): Promise<SiteConfig> {
  try {
    const raw = await readFile(SITE_JSON, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  const out = JSON.stringify(config, null, 2) + '\n';
  if (isVercelRuntime()) {
    const relPath = relative(ROOT, SITE_JSON).replace(/\\/g, '/');
    await writeFileToGitHub(relPath, out, 'Admin: update site config');
  } else {
    await writeFile(SITE_JSON, out, 'utf-8');
  }
}
