const GITHUB_API = 'https://api.github.com';

function envVar(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name] || process.env[name];
}

function token(): string {
  const t = envVar('GITHUB_TOKEN');
  if (!t) throw new Error('GITHUB_TOKEN missing — required for production saves');
  return t;
}

function repoConfig() {
  const owner = envVar('GITHUB_OWNER');
  const repo = envVar('GITHUB_REPO');
  const branch = envVar('GITHUB_BRANCH') || 'main';
  if (!owner || !repo) throw new Error('GITHUB_OWNER and GITHUB_REPO must be set');
  return { owner, repo, branch };
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function ghFetch(path: string, init?: RequestInit) {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

async function getFileSha(path: string): Promise<string | undefined> {
  const { owner, repo, branch } = repoConfig();
  const url = `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${branch}`;
  const res = await ghFetch(url);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub getFileSha failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function writeFileToGitHub(path: string, content: string, message: string): Promise<void> {
  const { owner, repo, branch } = repoConfig();
  const sha = await getFileSha(path);
  const url = `/repos/${owner}/${repo}/contents/${encodePath(path)}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const res = await ghFetch(url, { method: 'PUT', body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  }
}

export async function deleteFileFromGitHub(path: string, message: string): Promise<void> {
  const { owner, repo, branch } = repoConfig();
  const sha = await getFileSha(path);
  if (!sha) throw new Error(`File not found in repo: ${path}`);
  const url = `/repos/${owner}/${repo}/contents/${encodePath(path)}`;
  const body = { message, sha, branch };
  const res = await ghFetch(url, { method: 'DELETE', body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error(`GitHub delete failed: ${res.status} ${await res.text()}`);
  }
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1' || envVar('VERCEL') === '1';
}
