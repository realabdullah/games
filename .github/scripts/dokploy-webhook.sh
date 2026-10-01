#!/usr/bin/env bash
# Trigger a Dokploy redeploy through an application's deploy webhook.
#
# Usage: dokploy-webhook.sh <webhook-url> <label>
# Reads COMMIT_MESSAGE and GITHUB_SHA from the environment.
#
# The body mimics a GitHub push (x-github-event + head_commit) only so Dokploy
# labels the deployment with the commit message and hash. For apps using a
# Docker image, Dokploy then redeploys the image configured in the app.
set -euo pipefail

url="${1:?webhook URL required}"
label="${2:-app}"

body=$(jq -n \
	--arg id "${GITHUB_SHA:-}" \
	--arg message "${COMMIT_MESSAGE:-Deploy}" \
	'{head_commit: {id: $id, message: $message}}')

response=$(mktemp)
status=$(curl -sS -o "$response" -w '%{http_code}' -X POST "$url" \
	-H 'content-type: application/json' \
	-H 'x-github-event: push' \
	--data "$body")

echo "$label: HTTP $status $(cat "$response")"

# Dokploy answers 200 when the deploy is queued. It uses other codes (including
# 301) to refuse, e.g. "Automatic deployments are disabled", so only 200 counts.
if [ "$status" != "200" ]; then
	echo "::error::Dokploy did not accept the deploy for $label (HTTP $status)."
	exit 1
fi
