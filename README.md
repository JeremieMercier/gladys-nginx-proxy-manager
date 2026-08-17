# Gladys × Nginx Proxy Manager

External integration for [Gladys Assistant](https://gladysassistant.com) that
**installs and runs [Nginx Proxy Manager](https://nginxproxymanager.com/)**
(NPM) on the Gladys machine. Built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
from the official
[integration template](https://github.com/GladysAssistant/integration-template-js).

## How it works

The manifest declares Nginx Proxy Manager as a Gladys **sub-container** — the
docker-compose equivalent, translated to the Gladys sandbox:

| docker-compose                     | Gladys manifest (`containers` field)      |
| ---------------------------------- | ----------------------------------------- |
| `image: jc21/nginx-proxy-manager`  | `docker_image` (adapted build, see below) |
| `ports: 80, 81, 443`               | `ports` (host ports assigned by Gladys)   |
| `volumes: ./data`, `./letsencrypt` | `volumes: ["/data", "/etc/letsencrypt"]`  |
| `restart: unless-stopped`          | `start: "auto"` + supervisor              |

### Why an adapted image ([`npm-image/`](./npm-image))

The Gladys sandbox runs sub-containers with **all Linux capabilities dropped**
(`CapDrop=ALL` + `no-new-privileges`). The stock `jc21/nginx-proxy-manager`
image cannot boot there: its init creates the `npm` user at runtime (the
`useradd` rewrite of `/etc/shadow` needs `CAP_CHOWN`), chowns `/data` and the
certbot tree, and launches nginx/backend through `s6-setuidgid`, whose
`setgroups()` call needs `CAP_SETGID` even to stay root. Symptom with the
stock image: the container shows "running" but logs
`s6-rc: unable to start service prepare` and nothing listens on port 81.

With NPM's default `PUID=0`, that `npm` user is just an alias of root — so the
adapted image ([`npm-image/Dockerfile`](./npm-image/Dockerfile)) bakes the
user in at **build time** and replaces the three offending scripts with
capability-free equivalents (everything runs as root inside a container that
has _zero_ capabilities, which is tighter than the stock setup). Ports 80/443
need no capability either: Docker ≥ 20.10 sets
`net.ipv4.ip_unprivileged_port_start=0` in containers. `PUID`/`PGID`
overrides are not supported by this build.

The [`build-npm-image.yml`](.github/workflows/build-npm-image.yml) workflow
publishes it as `ghcr.io/jeremiemercier/gladys-nginx-proxy-manager-npm:2`
(multi-arch); re-run it to pick up upstream `jc21/nginx-proxy-manager:2`
updates. Reproduce the sandbox locally with:

```bash
docker build -t npm-gladys npm-image
docker run -d --cap-drop=ALL --security-opt no-new-privileges \
  -p 8181:81 -v npm-data:/data -v npm-le:/etc/letsencrypt npm-gladys
curl http://localhost:8181/api/   # -> {"status":"OK",...}
```

Gladys creates and supervises the container, persists its volumes, and shows
an **Open** link for the admin portal (browsable port 81). The integration
code is thin on purpose: it waits for the NPM API (`http://npm:81/api/` over
the integration's private network) and reports the health in the
Configuration screen, plus a **Check Nginx Proxy Manager** action button. No
device is created — proxy hosts are managed in the NPM web UI.

## Project structure

```
.
├─ index.js                          # SDK bootstrap: container watch + status
├─ src/
│  └─ npmApi.js                      # NPM health-check driver (GET /api/)
├─ docs/
│  ├─ en.md                          # user documentation (linked from Gladys)
│  └─ fr.md
├─ gladys-assistant-integration.json # manifest (sub-container, sections, image…)
└─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
```

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="nginx-proxy-manager" \
NPM_BASE_URL="http://localhost:81" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor when the
integration runs inside its sandboxed container. `NPM_BASE_URL` overrides the
in-sandbox DNS alias (`http://npm:81`) for local runs.

## Quality checks

```bash
npm run format:check   # Prettier: is everything formatted?
npm run format         # Prettier: format everything in place
npm run lint           # ESLint: catch real mistakes (unused vars, dead code…)
npm test               # Unit tests, via the built-in `node --test` runner
```

The same three checks run automatically on every push and pull request (see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Validate before publishing

```bash
npx github:GladysAssistant/integration-store .
```

It runs the exact same checks as the store indexer (manifest, Docker images —
main and sub-containers —, cover image, code rules) and reports every problem
at once.

## Release

Open **Actions → Release → Run workflow** and pick `patch`, `minor` or `major`:
the workflow bumps the version everywhere (`package.json` + manifest
`version`/`docker_image`), pushes the `vX.Y.Z` tag and builds the multi-arch
image (`linux/amd64` + `linux/arm64`) to `ghcr.io`. The decentralized indexer
then picks up the new manifest and Gladys offers a one-click install/update —
provided the repo is public and carries the `gladys-assistant-integration`
GitHub topic.

## License

Apache-2.0
