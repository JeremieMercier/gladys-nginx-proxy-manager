#!/command/with-contenv bash
# shellcheck shell=bash

# Gladys sandbox build: chown needs CAP_CHOWN, which the sandbox drops. All
# the paths NPM writes were already chowned to uid/gid 1000 at build time,
# and the Gladys-mounted volumes belong to 1000 as well: nothing to do.

set -e

log_info 'Skipping ownership changes (capability-free sandbox build, everything owned by uid 1000)'
