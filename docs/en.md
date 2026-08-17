# Nginx Proxy Manager integration

> ⚠️ **Not functional yet.** The Gladys sandbox currently drops all Linux
> capabilities from sub-containers, and the official Nginx Proxy Manager
> image cannot boot without some of them (creating its user, starting its
> services, listening on ports 80/81/443). The container shows as "running"
> but nothing listens on its port 81. This needs an evolution of the Gladys
> sub-container contract (a `cap_add` equivalent).

This integration **installs and runs
[Nginx Proxy Manager](https://nginxproxymanager.com/)** (NPM) directly on the
Gladys machine: nothing to install by hand, no docker-compose to write. Gladys
creates the official `jc21/nginx-proxy-manager` container, supervises it,
keeps its data and gives you direct access to its web portal.

## What the integration does

- **Automatic install**: when the integration is installed, Gladys pulls the
  official NPM image and starts the container (the docker-compose equivalent,
  inside the Gladys sandbox).
- **Supervision**: the container state is visible in Gladys; the configuration
  screen shows whether the NPM API answers, and a **Check Nginx Proxy
  Manager** button displays the running version.
- **Portal access**: an **Open** link in Gladys leads to the NPM admin portal.
  Management (proxy hosts, redirections, SSL certificates) happens in that
  portal, as usual.
- **Persistent data**: the NPM database (`/data`) and its certificates
  (`/etc/letsencrypt`) are kept by Gladys across restarts and updates.

## Install

1. Install the integration from the Gladys catalog. The install screen shows
   the container that will be created (image, published ports, limits);
   confirm.
2. Wait for the status to turn green (the first start initializes the NPM
   database, allow one to two minutes).
3. Open the portal through the **Open** link (or the URL shown in the "Access
   the portal" section).
4. First login: `admin@example.com` / `changeme` — NPM immediately asks you to
   change the email and the password.

## Expose your services on the internet

Gladys picks the ports published on the machine (they are shown in the
configuration screen, "Expose your services" section):

- the **HTTP** port maps to NPM's internal port 80;
- the **HTTPS** port maps to the internal port 443.

On your router, forward ports 80 and 443 to these two ports of the Gladys
machine so your domains and the Let's Encrypt challenges work.

## Good to know

- This integration creates no device in Gladys: NPM is managed from its own
  portal.
- Stopping the integration also stops the proxy; uninstalling the integration
  removes the container (volumes follow the Gladys data policy).
