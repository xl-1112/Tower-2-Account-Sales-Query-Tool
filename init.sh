#!/bin/bash
set -euo pipefail

echo "=== WeChat AI Skill Harness ==="
# Static/lint-like verification plus the standalone marketplace parser and UI build.
node scripts/validate-wechat-ai-skill.mjs
node scripts/validate-aion2-data-probe.mjs
(cd aion2-market-dashboard && npm test && npm run build)

echo "=== Git State ==="
git status --short

echo "=== Ready ==="
echo "Read feature_list.json and work on exactly one unfinished feature."
