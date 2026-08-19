# Nginx Proxy Manager integration

This integration **installs and runs
[Nginx Proxy Manager](https://nginxproxymanager.com/)** (NPM) directly on the
Gladys machine: nothing to install by hand, no docker-compose to write. Gladys
creates the container, supervises it, keeps its data and gives you direct
access to its web portal. (The image is a very lightly adapted build of the
official one, required to run inside the Gladys security sandbox — same
features.)

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
4. On your first visit, Nginx Proxy Manager asks you to create the
   administrator account (email + password of your choice).

## Expose your services on the internet

Gladys picks the ports published on the machine (they are shown in the
configuration screen, "Expose your services" section):

- the **HTTP** port maps to NPM's internal port 80;
- the **HTTPS** port maps to the internal port 443.

On your router, forward ports 80 and 443 to these two ports of the Gladys
machine so your domains and the Let's Encrypt challenges work.

## Where is my data?

The Nginx Proxy Manager data lives on the machine hosting Gladys, inside the
integration data folder:

```
/var/lib/gladysassistant/external-integrations/<identifier>/containers/npm/
├─ data/               # SQLite database (proxy hosts, accounts, settings),
│                      # generated nginx configurations, logs
└─ etc/letsencrypt/    # Let's Encrypt certificates and account keys
```

(`<identifier>` depends on your install — visible with `docker inspect` on
the `npm` container, mounts column.)

These folders survive restarts and updates. However, **uninstalling the
integration may remove them**: make a copy before any uninstall, and include
this path in your usual backups:

```bash
sudo tar czf ~/backup-npm-$(date +%F).tar.gz \
  /var/lib/gladysassistant/external-integrations/*/containers/npm
```

## Good to know

- This integration creates no device in Gladys: NPM is managed from its own
  portal.
- Stopping the integration also stops the proxy; uninstalling the integration
  removes the container (volumes follow the Gladys data policy).
