/**
 * git checkout — isomorphic-gitでワーキングツリーを最新コミットに同期する
 */
import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

const dir = 'C:\\Users\\大平暖\\.gemini\\antigravity\\scratch\\shuttle-board';

// Ignore these paths when checking out
const IGNORE = new Set(['node_modules', '.next', '.git', 'git-push.mjs', 'git-pull.mjs', 'git-checkout.mjs', 'verify.mjs']);

function shouldIgnore(filepath) {
  return filepath.split(/[/\\]/).some(p => IGNORE.has(p));
}

async function checkout() {
  console.log('🔄 git checkout HEAD — ワーキングツリーを最新コミットに同期\n');

  // Get HEAD commit
  const headSha = await git.resolveRef({ fs, dir, ref: 'HEAD' });
  console.log(`📌 HEAD: ${headSha.slice(0, 7)}\n`);

  // Read the commit tree
  const commitObj = await git.readCommit({ fs, dir, oid: headSha });
  const treeSha = commitObj.commit.tree;

  let checked = 0;
  let skipped = 0;

  async function checkoutTree(treeSha, basePath) {
    const tree = await git.readTree({ fs, dir, oid: treeSha });
    for (const entry of tree.tree) {
      const fullPath = basePath ? `${basePath}/${entry.path}` : entry.path;
      const absPath = path.join(dir, fullPath.replace(/\//g, path.sep));

      if (shouldIgnore(fullPath)) {
        skipped++;
        continue;
      }

      if (entry.type === 'tree') {
        // Directory
        if (!fs.existsSync(absPath)) {
          fs.mkdirSync(absPath, { recursive: true });
        }
        await checkoutTree(entry.oid, fullPath);
      } else if (entry.type === 'blob') {
        // File
        const blobResult = await git.readBlob({ fs, dir, oid: entry.oid });
        const content = Buffer.from(blobResult.blob);

        // Only write if file doesn't exist or content differs
        let needsWrite = true;
        if (fs.existsSync(absPath)) {
          const existing = fs.readFileSync(absPath);
          if (existing.equals(content)) {
            needsWrite = false;
          }
        } else {
          // Ensure parent dir exists
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
        }

        if (needsWrite) {
          fs.writeFileSync(absPath, content);
          console.log(`  ✍️  ${fullPath}`);
          checked++;
        }
      }
    }
  }

  await checkoutTree(treeSha, '');

  console.log(`\n✅ チェックアウト完了`);
  console.log(`   書き込み: ${checked} ファイル`);
  console.log(`   スキップ: ${skipped} エントリ`);
}

checkout().catch(err => {
  console.error('💥 エラー:', err.message);
  process.exit(1);
});
