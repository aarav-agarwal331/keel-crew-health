#!/usr/bin/env bash
# Deploy the built app to GitHub Pages (free static hosting).
# Needs: the GitHub CLI (`gh auth status` must show a logged-in account) and a pushed repository.
# Usage: ./deploy.sh            (run `make build` first, or use `make deploy`)
set -euo pipefail
cd "$(dirname "$0")"

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub. Run: gh auth login   then: ./deploy.sh" >&2
  exit 1
fi
REPO_NAME="${KEEL_REPO:-keel-crew-health}"
OWNER="$(gh api user -q .login)"
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$REPO_NAME" --public --source . --remote origin \
    --description "Keel: a crew health monitor that keeps working when Earth cannot answer. NASA Space Apps 2026."
fi
git push -u origin main

# rebuild with links from every figure to the script that made it
(cd app && VITE_REPO_URL="https://github.com/$OWNER/$REPO_NAME" npm run build)

TMP="$(mktemp -d)"
cp -R app/dist/. "$TMP/"
touch "$TMP/.nojekyll"
(
  cd "$TMP"
  git init -q -b gh-pages
  git add -A
  git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Deploy Keel"
  git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
)
rm -rf "$TMP"
gh api -X POST "repos/$OWNER/$REPO_NAME/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
echo "Deployed: https://$OWNER.github.io/$REPO_NAME/"
