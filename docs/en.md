# Nginx Proxy Manager integration

This integration connects Gladys Assistant to your
[Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM) instance, the
reverse proxy manager with a web UI.

It is a deliberately **minimal** integration: it creates no device. It stores
the access to your NPM instance, verifies that Gladys can reach it, and gives
you a quick access to the admin portal.

## What the integration does

- **Test the connection**: a button in the configuration screen checks the URL
  and the credentials, then displays the version of your NPM instance and the
  number of configured proxy hosts.
- **NPM portal**: a button that displays the admin portal URL you configured,
  so you can find it at a glance from Gladys.
- The connection status (reachable or not) is permanently shown in the
  integration configuration screen.

## Requirements

- A Nginx Proxy Manager instance reachable **from the Gladys network** (the
  admin interface, port `81` by default).
- An NPM **administrator** account (the same email/password as the web UI).

## Configuration

1. Install the integration from the Gladys catalog.
2. In the configuration screen, fill in:
   - **Admin interface URL**: for example `http://192.168.1.10:81` (no trailing
     `/`, the URL you open in your browser);
   - **Administrator email** and **Administrator password**.
3. Save, then click **Test the connection**: the version of your NPM instance
   is displayed when everything is fine.

## Good to know

- Managing the proxy hosts (creation, enabling, certificates…) stays in the
  Nginx Proxy Manager interface: use the **NPM portal** button to find its
  address.
- The Gladys UI cannot directly open an external page from an integration:
  the button therefore displays the URL to open in your browser.
