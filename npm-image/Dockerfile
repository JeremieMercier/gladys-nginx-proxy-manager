# -----------------------------------------------------------------------------
# Nginx Proxy Manager, adapted to the Gladys sub-container sandbox.
#
# The Gladys supervisor runs sub-containers with ALL Linux capabilities
# dropped (+ no-new-privileges), and mounts the declared volumes from host
# folders owned by uid/gid 1000 (the integration user), mode 755. That
# combination rules the stock image out twice:
#   - its init needs capabilities root no longer has (useradd rewriting
#     /etc/shadow -> CAP_CHOWN; s6-setuidgid -> CAP_SETGID; chown of /data);
#   - root without CAP_DAC_OVERRIDE cannot even write into the uid-1000
#     volumes ("mkdir: cannot create directory '/data/nginx'").
#
# So this build runs EVERYTHING as uid 1000 (matching the volume owner):
#   - the npm user/group are baked in at build time (uid/gid 1000);
#   - every path NPM writes at runtime is chowned to 1000 at build time;
#   - the init scripts that needed root or capabilities are replaced;
#   - USER 1000 -> not even nominal root inside the container.
#
# Ports 80/81/443 need no capability: Docker >= 20.10 sets
# net.ipv4.ip_unprivileged_port_start=0 inside containers.
# PUID/PGID overrides are not supported by this build (fixed to 1000).
# -----------------------------------------------------------------------------

FROM jc21/nginx-proxy-manager:2

ARG NPM_UID=1000
ARG NPM_GID=1000

# Real npm user matching the owner of the Gladys-mounted volumes, plus
# ownership of every path written at runtime (nginx configs and caches, s6's
# /run, certbot's tree so on-demand DNS plugins can still pip-install).
RUN groupadd -o -g "$NPM_GID" npm \
	&& useradd -o -u "$NPM_UID" -g "$NPM_GID" -d /tmp/npmuserhome -s /bin/false npm \
	&& mkdir -p /tmp/npmuserhome /var/log/letsencrypt /var/lib/letsencrypt \
		/var/lib/logrotate /run/nginx /var/cache/nginx /var/lib/nginx /var/log/nginx \
		/data /etc/letsencrypt \
	&& chown -R "$NPM_UID:$NPM_GID" \
		/run \
		/etc/nginx \
		/etc/logrotate.d \
		/var/log/nginx \
		/var/lib/nginx \
		/var/cache/nginx \
		/var/lib/logrotate \
		/var/lib/letsencrypt \
		/var/log/letsencrypt \
		/tmp/npmuserhome \
		/opt/certbot \
		/data \
		/etc/letsencrypt

# The leftover `chown "$PUID:$PGID"` calls in upstream scripts become no-ops
# (files already belong to 1000:1000) instead of EPERM.
ENV PUID=${NPM_UID} PGID=${NPM_GID}

# Replace the init/run scripts that require root or dropped capabilities.
COPY rootfs/ /
RUN chmod +x \
	/etc/s6-overlay/s6-rc.d/prepare/00-all.sh \
	/etc/s6-overlay/s6-rc.d/prepare/10-usergroup.sh \
	/etc/s6-overlay/s6-rc.d/prepare/30-ownership.sh \
	/etc/s6-overlay/s6-rc.d/backend/run \
	/etc/s6-overlay/s6-rc.d/nginx/run

USER ${NPM_UID}:${NPM_GID}
