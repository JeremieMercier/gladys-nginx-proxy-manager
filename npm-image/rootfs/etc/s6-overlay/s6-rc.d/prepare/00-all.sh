#!/command/with-contenv bash
# shellcheck shell=bash

# Gladys sandbox build: same orchestration as upstream, minus the "must run
# as root" check — this build runs everything as uid 1000 on purpose (the
# owner of the Gladys-mounted volumes; root without CAP_DAC_OVERRIDE could
# not write into them anyway).

set -e

. /usr/bin/common.sh

if [ "$DEBUG" = "true" ]; then
	set -x
fi

. /etc/s6-overlay/s6-rc.d/prepare/10-usergroup.sh
. /etc/s6-overlay/s6-rc.d/prepare/20-paths.sh
. /etc/s6-overlay/s6-rc.d/prepare/30-ownership.sh
. /etc/s6-overlay/s6-rc.d/prepare/40-dynamic.sh
. /etc/s6-overlay/s6-rc.d/prepare/50-ipv6.sh
. /etc/s6-overlay/s6-rc.d/prepare/60-secrets.sh
. /etc/s6-overlay/s6-rc.d/prepare/90-banner.sh
