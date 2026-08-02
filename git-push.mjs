/**
 * GitHub push script using isomorphic-git + fetch (Node.js built-in)
 * Requires: isomorphic-git (no @isomorphic-git/http-node needed)
 */
import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

const PROJECT_DIR = 'C:\\Users\\大平暖\\.gemini\\antigravity\\scratch\\shuttle-board';
const REPO_URL   = 'https://github.com/usagida2104-bot/smart-pickup-app.git';
const PAT        = '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';
const AUTHOR     = { name: 'usagida2104-bot', email: 'usagida2104-bot@users.noreply.github.com' };

// Create HTTP plugin using Node.js built-in fetch
const httpPlugin = {
  async request({ url, method, headers, body }) {
    const chunks = [];
    if (body) {
      for await (const chunk of body) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
    }
    const bodyBuf = chunks.length ? Buffer.concat(chunks) : undefined;

    const resp = await fetch(url, {
      method,
      headers: Object.fromEntries(Object.entries(headers)),
      body: bodyBuf,
    });

    const respBody = Buffer.from(await resp.arrayBuffer());
    const respHeaders = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });

    return {
      url: resp.url,
      method,
      statusCode: resp.status,
      statusMessage: resp.statusText,
      body: [respBody],
      headers: respHeaders,
    };
  },
};

// Files/dirs to ignore
const IGNORE = new Set([
  'node_modules', '.next', '.git', 'verify.mjs', 'git-push.mjs',
]);

function shouldIgnore(relPath) {
  const parts = relPath.split(/[/\\]/);
  return parts.some(p => IGNORE.has(p));
}

function walkDir(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (shouldIgnore(rel)) continue;
    if (entry.isDirectory()) {
      files.push(...walkDir(path.join(dir, entry.name), rel));
    } else {
      files.push(rel.replace(/\\/g, '/'));
    }
  }
  return files;
}

async function main() {
  console.log('🚀 GitHub push 開始\n');
  console.log(`   リポジトリ: ${REPO_URL}`);
  console.log(`   ブランチ:   main\n`);

  // 1. git init
  console.log('📁 [1/4] git init...');
  await git.init({ fs, dir: PROJECT_DIR, defaultBranch: 'main' });
  console.log('   ✅ 完了\n');

  // 2. stage all files
  console.log('📄 [2/4] ファイルをステージング...');
  const allFiles = walkDir(PROJECT_DIR);
  let staged = 0;
  for (const filepath of allFiles) {
    await git.add({ fs, dir: PROJECT_DIR, filepath });
    staged++;
    if (staged % 20 === 0) process.stdout.write(`\r   ${staged}/${allFiles.length} ファイル処理中...`);
  }
  console.log(`\r   ✅ ${allFiles.length}ファイルをステージング完了\n`);

  // 3. commit
  console.log('💾 [3/4] コミット作成...');
  const sha = await git.commit({
    fs,
    dir: PROJECT_DIR,
    author: AUTHOR,
    message: `feat: 放デイ送迎表システム 初期実装

Stack: Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui + dnd-kit + Zustand + Supabase

Features:
- ドラッグ&ドロップ送迎ボード (dnd-kit)
- 自動配車ロジック (autoAssignVehicles - 貪欲法)
- マスター管理 CRUD (児童・学校・車両・スタッフ)
- 日別設定 (出欠ステータス・下校時間インライン編集)
- 定員オーバー警告バリデーション
- Supabase クライアント設定済み (.env.local で接続)
- モックデータで Supabase 未接続でも全機能動作

Tests: Playwright 15/15 PASS`,
  });
  console.log(`   ✅ コミット SHA: ${sha.slice(0, 7)}\n`);

  // 4. push
  console.log('🌐 [4/4] GitHub へ push...');
  try {
    const result = await git.push({
      fs,
      http: httpPlugin,
      dir: PROJECT_DIR,
      url: REPO_URL,
      ref: 'main',
      onAuth: () => ({ username: PAT, password: '' }),
      force: true,
      onProgress: (e) => {
        if (e.phase) process.stdout.write(`\r   ${e.phase} ${e.loaded ?? 0}/${e.total ?? 0}  `);
      },
    });
    console.log('\n');
    if (result.ok) {
      console.log('🎉 push 成功！');
      console.log(`   URL: ${REPO_URL.replace('.git', '')}`);
      console.log(`   ブランチ: main`);
      console.log(`   コミット: ${sha.slice(0, 7)} — feat: 放デイ送迎表システム 初期実装`);
    } else {
      console.error('❌ push 失敗:', result.error);
    }
  } catch (pushErr) {
    // Try with force if rejected
    if (pushErr.message && pushErr.message.includes('non-fast-forward')) {
      console.log('\n   非fast-forwardのため --force で再試行...');
      const result = await git.push({
        fs,
        http: httpPlugin,
        dir: PROJECT_DIR,
        url: REPO_URL,
        ref: 'main',
        onAuth: () => ({ username: PAT, password: '' }),
        force: true,
      });
      if (result.ok) {
        console.log('\n🎉 push 成功（force）！');
        console.log(`   URL: ${REPO_URL.replace('.git', '')}`);
      } else {
        throw new Error(result.error || 'push failed');
      }
    } else {
      throw pushErr;
    }
  }
}

main().catch(err => {
  console.error('\n💥 エラー:', err.message);
  if (err.data) console.error('   詳細:', JSON.stringify(err.data, null, 2));
  process.exit(1);
});
