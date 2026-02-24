import { $ } from "bun";

export interface SearchResult {
  fullName: string;
  description: string;
  url: string;
}

export async function searchRepos(query?: string): Promise<SearchResult[]> {
  const searchQuery = query
    ? `${query} topic:claude-dotfiles`
    : "topic:claude-dotfiles";

  const result = await $`gh search repos ${searchQuery} --json fullName,description,url --limit 20`.text();
  return JSON.parse(result);
}

export async function fetchManifest(repo: string): Promise<unknown> {
  const result = await $`gh api repos/${repo}/contents/claude-dotfiles.json --jq .content`.text();
  const decoded = Buffer.from(result.trim(), "base64").toString("utf-8");
  return JSON.parse(decoded);
}

export async function fetchFile(repo: string, path: string): Promise<string> {
  const result = await $`gh api repos/${repo}/contents/${path} --jq .content`.text();
  return Buffer.from(result.trim(), "base64").toString("utf-8");
}

export async function cloneRepo(repo: string, dest: string): Promise<void> {
  await $`gh repo clone ${repo} ${dest} -- --depth 1`;
}

export async function createRepo(name: string, description: string): Promise<string> {
  const result = await $`gh repo create ${name} --public --description ${description} --clone=false`.text();
  return result.trim();
}

export async function addTopic(repo: string): Promise<void> {
  const current = await $`gh api repos/${repo} --jq .topics`.text();
  const topics: string[] = JSON.parse(current);
  if (!topics.includes("claude-dotfiles")) {
    topics.push("claude-dotfiles");
    await $`gh api repos/${repo} -X PATCH -f names=${JSON.stringify(topics)}`.quiet();
  }
}

export async function pushToGithub(dir: string, repo: string): Promise<void> {
  await $`git -C ${dir} remote add origin https://github.com/${repo}.git`.quiet().nothrow();
  await $`git -C ${dir} push -u origin main`;
}
