#!/command/with-contenv bash
# shellcheck shell=bash

# Gladys sandbox build: the $NPMUSER user and $NPMGROUP group are baked into
# the image at build time (uid/gid 1000, the owner of the Gladys-mounted
# volumes). The original runtime useradd/usermod cannot work here: rewriting
# /etc/shadow needs CAP_CHOWN, which the sandbox drops. PUID/PGID overrides
# are therefore not supported by this image (fixed to 1000).

set -e

log_info "User $NPMUSER baked into the image as uid $PUID (capability-free sandbox build)"

mkdir -p "$NPMHOME"
