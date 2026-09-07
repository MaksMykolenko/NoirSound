#!/usr/bin/env bash
# Direct arbitrary-target restore was intentionally removed.
set -euo pipefail
printf "%s\n" "Refusing direct restore. Use restore-drill.sh with explicit archive pair/manifest and NOIRSOUND_RESTORE_TEST=1; targets are generated and owned by that run." >&2
exit 1
