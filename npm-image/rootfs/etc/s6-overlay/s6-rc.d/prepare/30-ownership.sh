#!/command/with-contenv bash
# shellcheck shell=bash

# Gladys sandbox build: chown needs CAP_CHOWN, which the sandbox drops — and
# with PUID=0 every process runs as root, so ownership changes are pointless:
# whatever root creates is already root-owned.

set -e

log_info 'Skipping ownership changes (capability-free sandbox build, PUID=0)'
