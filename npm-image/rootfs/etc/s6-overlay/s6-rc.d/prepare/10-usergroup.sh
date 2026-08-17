#!/command/with-contenv bash
# shellcheck shell=bash

# Gladys sandbox build: the $NPMUSER user and $NPMGROUP group are baked into
# the image (root aliases, PUID=0). The original runtime useradd/usermod
# cannot work here: rewriting /etc/shadow needs CAP_CHOWN, which the sandbox
# drops. PUID/PGID overrides are therefore not supported by this image.

set -e

log_info "User $NPMUSER baked into the image (capability-free sandbox build)"

if [ "$PUID" != '0' ] || [ "$PGID" != '0' ]; then
	log_error "PUID/PGID are not supported by this build: everything runs as root (PUID=0)"
fi

mkdir -p "$NPMHOME"
