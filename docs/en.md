# Nginx Proxy Manager integration

This integration connects Gladys Assistant to your
[Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM) instance, the
reverse proxy manager with a web UI.

## What the integration does

- **One device per proxy host**: every proxy host configured in NPM shows up as
  a Gladys device with an **Enabled/Disabled** switch. You can enable or cut a
  proxy host from the dashboard, a scene or the chat — handy to temporarily
  block access to an exposed service.
- **One monitoring device** named "Nginx Proxy Manager" with:
  - the number of proxy hosts, redirections, streams and 404 hosts;
  - the number of managed SSL certificates;
  - the number of days before the next certificate expires (ideal to trigger
    an alert from a scene).

## Requirements

- A Nginx Proxy Manager instance reachable **from the Gladys network** (the
  admin interface, port `81` by default).
- An NPM **administrator** account (the same email/password as the web UI).

## Configuration

1. Install the integration from the Gladys catalog.
2. In the configuration screen, fill in:
   - **Admin interface URL**: for example `http://192.168.1.10:81` (no trailing
     `/`, the URL you open in your browser);
   - **Administrator email** and **Administrator password**;
   - **Refresh interval** (optional, 60 s by default).
3. Save, then click **Test the connection**: the version of your NPM instance
   and the number of proxy hosts are displayed when everything is fine.
4. Run a device scan: the server and all your proxy hosts appear, ready to be
   added to a room.

## Good to know

- Disabling a proxy host in Gladys has the same effect as in the NPM UI: the
  domain answers a 502 error while it is disabled.
- If you add or remove proxy hosts in NPM, simply run a new device scan in
  Gladys to refresh the list.
- Each device identifier is based on the internal NPM id of the proxy host:
  renaming a domain in NPM does not break the history in Gladys.
