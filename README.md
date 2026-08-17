# Gladys × Nginx Proxy Manager

External integration for [Gladys Assistant](https://gladysassistant.com) that
connects your [Nginx Proxy Manager](https://nginxproxymanager.com/) (NPM)
instance, built with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
from the official
[integration template](https://github.com/GladysAssistant/integration-template-js).

A deliberately **minimal** integration: it creates no device. It stores the
NPM connection settings, verifies them against the NPM admin REST API (the
same one its web UI uses, `http://<host>:81/api` by default), and offers two
buttons in the Gladys configuration screen:

- **Test the connection** — checks the URL/credentials, reports the NPM
  version and the number of proxy hosts;
- **NPM portal** — displays the configured admin portal URL.

Managing the proxy hosts themselves (creation, enabling, certificates…) stays
in the NPM web interface.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + action handlers
├─ src/
│  ├─ npmApi.js                      # NPM REST API client (auth, version, counts)
│  └─ config.js                      # config defaults + normalization
├─ docs/
│  ├─ en.md                          # user documentation (linked from Gladys)
│  └─ fr.md
├─ gladys-assistant-integration.json # manifest (name, config schema, image…)
└─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
```

## Configuration (in Gladys)

| Field                  | Description                    |
| ---------------------- | ------------------------------ |
| Admin interface URL    | e.g. `http://192.168.1.10:81`  |
| Administrator email    | the NPM admin account email    |
| Administrator password | the NPM admin account password |

See [`docs/fr.md`](./docs/fr.md) / [`docs/en.md`](./docs/en.md) for the full
user guide.

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="nginx-proxy-manager" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` variables are injected by the Gladys supervisor when the
integration runs inside its sandboxed container. The SDK reads them
automatically.

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

It runs the exact same checks as the store indexer (manifest, Docker image,
cover image, code rules) and reports every problem at once.

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
