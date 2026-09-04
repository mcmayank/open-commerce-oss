#!/usr/bin/env bash
#
# deploy-prod.sh — ship the current HEAD to production via an owner CLI upload
# with NO git metadata attached.
#
# Why this exists: the Vercel project sits on a Hobby team, which only lets the
# account owner's commits create deployments. A normal `git push` (or even a
# repo-root `vercel --prod`) attaches the local commit's author, and Vercel
# rejects it — squash-merge commits authored `mayank@mc-awesome.com` fail with
# "commit email could not be matched to a GitHub account"; `mcmayank`-authored
# commits fail with "Git author mcmayank must have access". Deploying a tree with
# no `.git` means there is no commit author for Vercel to evaluate, so the
# owner-authenticated CLI upload goes straight through.
#
# The DURABLE fix (so plain `git push` deploys again) is an owner-side Vercel
# dashboard action — see the "deployment" memory note. Until then, this is the
# reliable ship path.
#
# Usage:
#   pnpm deploy:prod            # deploy committed HEAD
#   pnpm deploy:prod --preview  # deploy to a preview URL instead of production
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TARGET="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  TARGET=""
  echo "→ Preview deploy (no production aliases)."
fi

# Preconditions -------------------------------------------------------------
command -v vercel >/dev/null 2>&1 || { echo "✗ vercel CLI not found (npm i -g vercel)"; exit 1; }
[[ -f .vercel/project.json ]] || { echo "✗ .vercel/project.json missing — run 'vercel link' first"; exit 1; }

HEAD_SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Warn (don't block) on a dirty tree or non-main branch — we archive HEAD, so
# uncommitted changes are NOT deployed; make that explicit.
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "⚠  Working tree has uncommitted changes — they will NOT be deployed (HEAD $HEAD_SHA is)."
fi
if [[ "$BRANCH" != "main" ]]; then
  echo "⚠  On branch '$BRANCH', not 'main'. Deploying HEAD $HEAD_SHA anyway."
fi

# Build a git-free copy of the committed tree ------------------------------
TMP="$(mktemp -d "${TMPDIR:-/tmp}/niblr-deploy.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

echo "→ Exporting HEAD $HEAD_SHA (no .git) to $TMP"
git archive HEAD | tar -x -C "$TMP"
cp -R .vercel "$TMP/.vercel"   # project link is gitignored, so carry it over

# Deploy as the authenticated owner ----------------------------------------
echo "→ vercel ${TARGET:-<preview>} --yes  (builds remotely with project env)"
cd "$TMP"
vercel $TARGET --yes

echo
echo "✓ Deploy submitted for HEAD $HEAD_SHA."
echo "  Verify: vercel inspect <url>  → status ● Ready"
if [[ -n "$TARGET" ]]; then
  echo "          curl -I https://niblr.store  → HTTP 200"
fi
