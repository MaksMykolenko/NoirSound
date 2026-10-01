#!/usr/bin/env bash
# GitHub Ubuntu runners: avoid optional GUI packages and bound slow APT mirrors.
set -euo pipefail
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then
  ffmpeg -version | head -n 1
  ffprobe -version | head -n 1
  exit 0
fi
# The runner's HTTP Azure mirror stalled on package bodies while metadata was fast.
# Use Ubuntu's official HTTPS archive for these disposable runners. APT retains
# signed Release/package verification; no unauthenticated downloads are permitted.
sudo python3 - <<'APT'
from pathlib import Path
paths = [Path('/etc/apt/apt-mirrors.txt'), Path('/etc/apt/sources.list')]
paths += list(Path('/etc/apt/sources.list.d').glob('*.sources'))
paths += list(Path('/etc/apt/sources.list.d').glob('*.list'))
for path in paths:
    if path.is_file() and not path.is_symlink():
        text = path.read_text()
        updated = text.replace('http://azure.archive.ubuntu.com/ubuntu', 'https://archive.ubuntu.com/ubuntu')
        updated = updated.replace('https://azure.archive.ubuntu.com/ubuntu', 'https://archive.ubuntu.com/ubuntu')
        if updated != text:
            path.write_text(updated)
APT
apt_options=(-o Acquire::Retries=2 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 -o DPkg::Lock::Timeout=30)
for attempt in 1 2; do
  if sudo timeout --kill-after=10s 90s apt-get "${apt_options[@]}" update \
    && sudo timeout --kill-after=10s 120s apt-get "${apt_options[@]}" install --no-install-recommends -y ffmpeg; then
    ffmpeg -version | head -n 1
    ffprobe -version | head -n 1
    exit 0
  fi
  printf 'FFmpeg APT attempt %s failed or reached its time limit.\n' "$attempt" >&2
done
printf 'FFmpeg installation failed after two bounded attempts.\n' >&2
exit 1
