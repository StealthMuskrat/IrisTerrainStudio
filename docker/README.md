# Self-hosting Iris Terrain Studio

The container runs the pack-management server and serves the already-built browser application. Terrain generation stays in browser workers. Build the standalone distribution first so the image includes the checked engine, matching registry, corresponding source/licenses and native starter resources.

## Prepare the distribution

Use Node 24 from the repository root. Follow the engine setup section in the main README if the local engine/registry is not installed. Cold engine compilation captures class inputs; a missing full registry requires one intentional `npm run engine:registry` export. Engine and registry input identities must match. No terrain generation or registry export occurs when building or starting the runtime image.

```sh
npm run build -- --require-engine
```

To include authorized provisioned rendering defaults, prepare them with `npm run assets:defaults` and add `--include-local-assets` to the build command. Otherwise local asset inputs stay outside the distribution. Both catalog and ZIP delivery require the configured server token.

This stages `dist/` atomically and checks installed module identities. It is a development package, not release/parity certification. Keep the generated source archive, licenses and notices in the image. `--release` remains blocked while qualification is incomplete.

## Start with persistent packs

Create a local Compose environment file containing a random access token. It is ignored by Git. Do not paste the token into logs or issue reports.

```sh
umask 077
node -e "process.stdout.write('IRIS_STUDIO_TOKEN='+require('node:crypto').randomBytes(32).toString('hex')+'\n')" > docker/.env
docker compose --env-file docker/.env -f docker/compose.yaml up --build -d
```

Open `http://127.0.0.1:4783` and enter that token in the application. The named `iris-packs` volume stores native pack files and versioned backups at `/data/packs`; container replacement retains the volume. The application runs as the Node user, with a read-only root filesystem and temporary `/tmp`. Creation/import staging and all pack writes stay under the pack volume.

`GET /healthz` reports server liveness without authentication or pack information. The Docker health check uses that endpoint. Authenticated Runtime status in the application reports engine availability separately. A live server does not prove browser/WebGPU or native parity readiness.

## HTTPS access

Keep the Compose host port bound to loopback. Use a TLS reverse proxy on the host for remote browser access; WebGPU requires a secure browser context. For example, a Caddy site with your actual DNS name can forward to the loopback port:

```caddy
terrain.example.com {
    reverse_proxy 127.0.0.1:4783
}
```

Preserve the original Host header and normal same-origin requests. The browser sends its access token to the server for pack operations. The server refuses non-loopback binding without a token of at least 32 characters. Generated chunks, sample arrays and meshes are not application API data and remain in the browser.

## Verification status

The standalone package and small real HTTP persistence/authentication/static-asset checks are executable without Docker. The current workspace has no Docker executable and its browser preview service is unavailable, so image startup, read-only-volume behavior inside Docker, reverse-proxy/browser access and measured performance remain unverified. The development base image tag remains `node:24-alpine`; qualify and record its exact OCI digest for a production release. The supplied F8thful and matching vanilla baseline are provisioned locally; include them explicitly only for authorized deployments. Native reference and complete client compatibility qualification remain open.
