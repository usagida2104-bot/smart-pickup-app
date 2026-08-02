/**
 * git pull origin main — using isomorphic-git
 */
import git from 'isomorphic-git';
import fs from 'fs';

const PROJECT_DIR = 'C:\\Users\\大平暖\\.gemini\\antigravity\\scratch\\shuttle-board';
const REPO_URL   = 'https://github.com/usagida2104-bot/smart-pickup-app.git';
const PAT        = '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';
const AUTHOR     = { name: 'usagida2104-bot', email: 'usagida2104-bot@users.noreply.github.com' };

// Node.js fetch-based HTTP plugin
const httpPlugin = {
  async request({ url, method, headers, body }) {
    const chunks = [];
    if (body) {
      for await (const chunk of body) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
    }
    const resp = await fetch(url, {
      method,
      headers: Object.fromEntries(Object.entries(headers)),
      body: chunks.length ? Buffer.concat(chunks) : undefined,
    });
    const respBody = Buffer.from(await resp.arrayBuffer());
    const respHeaders = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    return {
      url: resp.url, method,
      statusCode: resp.status,
      statusMessage: resp.statusText,
      body: [respBody],
      headers: respHeaders,
    };
  },
};

async function main() {
  console.log('⬇️  git pull origin main\n');

  // remote "origin" を設定
  try {
    await git.addRemote({ fs, dir: PROJECT_DIR, remote: 'origin', url: REPO_URL });
  } catch (e) {
    if (!e.message?.includes('already exists')) throw e;
    // already set, update it
    await git.deleteRemote({ fs, dir: PROJECT_DIR, remote: 'origin' });
    await git.addRemote({ fs, dir: PROJECT_DIR, remote: 'origin', url: REPO_URL });
  }

  // fetch
  console.log('🌐 リモートから最新情報を取得中...');
  await git.fetch({
    fs,
    http: httpPlugin,
    dir: PROJECT_DIR,
    remote: 'origin',
    url: REPO_URL,
    ref: 'main',
    remoteRef: 'refs/heads/main',
    onAuth: () => ({ username: PAT, password: '' }),
    singleBranch: true,
    onProgress: e => {
      if (e.phase) process.stdout.write(`\r   ${e.phase} ${e.loaded ?? 0}/${e.total ?? 0}  `);
    },
  });
  console.log('\n   ✅ fetch 完了\n');


  // merge: refs/remotes/origin/main → main
  console.log('🔀 merge 中...');
  try {
    // Get remote HEAD SHA
    const remoteRef = await git.resolveRef({
      fs, dir: PROJECT_DIR, ref: 'refs/remotes/origin/main'
    }).catch(() => null);

    if (!remoteRef) {
      console.log('   ✅ Already up to date.\n');
      return;
    }

    await git.merge({
      fs,
      dir: PROJECT_DIR,
      ours: 'main',
      theirs: remoteRef,
      author: AUTHOR,
      fastForwardOnly: true,
    });
    console.log('   ✅ fast-forward merge 完了\n');
  } catch (e) {
    // Already up to date
    if (e.code === 'AlreadyMergedError' || e.message?.includes('Already merged')) {
      console.log('   ✅ Already up to date.\n');
    } else {
      throw e;
    }
  }

  // show current HEAD
  const head = await git.resolveRef({ fs, dir: PROJECT_DIR, ref: 'HEAD' });
  const log  = await git.log({ fs, dir: PROJECT_DIR, depth: 1 });
  const latest = log[0]?.commit;

  console.log('📋 最新状態:');
  console.log(`   コミット: ${head.slice(0, 7)}`);
  if (latest) {
    console.log(`   メッセージ: ${latest.message.split('\n')[0]}`);
    console.log(`   著者: ${latest.author.name}`);
    const d = new Date(latest.author.timestamp * 1000);
    console.log(`   日時: ${d.toLocaleString('ja-JP')}`);
  }
  console.log('\n✅ pull 完了');
}

main().catch(err => {
  console.error('\n💥 エラー:', err.message ?? err);
  process.exit(1);
});
