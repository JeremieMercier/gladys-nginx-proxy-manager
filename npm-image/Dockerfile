# -----------------------------------------------------------------------------
# Nginx Proxy Manager, adapted to the Gladys sub-container sandbox.
#
# The Gladys supervisor runs sub-containers with ALL Linux capabilities
# dropped (+ no-new-privileges). The stock image cannot boot there:
#   - its init creates the `npm` user at runtime (useradd -> /etc/shadow
#     rewrite -> CAP_CHOWN on the backup files);
#   - it chowns /data, /etc/letsencrypt, certbot... (CAP_CHOWN);
#   - it starts nginx and the backend through s6-setuidgid, whose
#     setgroups() call requires CAP_SETGID even to stay root.
#
# With the default PUID=0/PGID=0 the `npm` user is just an alias of root,
# so none of those steps is actually needed: bake the user at BUILD time
# (where capabilities exist) and replace the offending scripts with
# capability-free equivalents. Everything simply runs as root, which is
# what PUID=0 meant anyway.
#
# Ports 80/81/443 stay unchanged: Docker >= 20.10 sets
# net.ipv4.ip_unprivileged_port_start=0 in containers, so binding them
# needs no CAP_NET_BIND_SERVICE.
# -----------------------------------------------------------------------------

FROM jc21/nginx-proxy-manager:2

# Bake the npm user/group (root aliases, PUID=0) at build time.
RUN useradd -o -u 0 -g 0 -d /tmp/npmuserhome -s /bin/false npm \
	&& groupadd -f -o -g 0 npm \
	&& mkdir -p /tmp/npmuserhome

# Replace the init/run scripts that require dropped capabilities.
COPY rootfs/ /
RUN chmod +x \
	/etc/s6-overlay/s6-rc.d/prepare/10-usergroup.sh \
	/etc/s6-overlay/s6-rc.d/prepare/30-ownership.sh \
	/etc/s6-overlay/s6-rc.d/backend/run \
	/etc/s6-overlay/s6-rc.d/nginx/run
