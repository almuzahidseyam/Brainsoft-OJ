# Brainsoft-OJ

A local practice judge for Python, C++17 and Java 21, with a React editor,
SQLite problem archive and an isolated Linux container for each test case.

This is an owner-operated learning tool. It is **not a public multi-user judge**.
See [the execution boundary](SECURITY.md) before enabling submissions.

## Requirements

- Node.js 24 LTS, version 24.14 or later within the 24.x release line.
- Docker Engine on Linux, or Docker Desktop using Linux containers.
- Windows, Linux or macOS for the API/frontend. No host compiler is required.

SQLite comes with Node; there is no native npm database addon to compile. Docker
is necessary for judging; without it, the problem archive still works and all
submissions are refused.

## Setup

From the repository root:

```sh
npm ci --prefix backend
npm ci --prefix frontend
docker build -t brainsoft-judge:local backend/runner
```

The first image build needs the internet to install the language toolchains.
Rebuild it periodically to receive operating-system/compiler updates. Judging
does not pull images and contestant containers cannot access the network.

Generate a random access token locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use the generated value in the backend terminal. Do not commit or share it.

PowerShell:

```powershell
$env:JUDGE_ENABLED = 'true'
$env:JUDGE_ACCESS_TOKEN = '<your-generated-token>'
npm start --prefix backend
```

Linux/macOS:

```sh
export JUDGE_ENABLED=true
export JUDGE_ACCESS_TOKEN='<your-generated-token>'
npm start --prefix backend
```

In a second terminal:

```sh
npm run dev --prefix frontend
```

Open the address Vite prints (normally `http://127.0.0.1:5173`). Open **A + B
Problem**, enter the owner token and submit:

```python
print(sum(map(int, input().split())))
```

The expected verdict is **Accepted**. The token clears on page refresh. Use
`public class Solution` for Java. Do not run several backend instances against
the same Docker engine; the API uses fixed loopback port 5000.

## How judging works

1. Authenticate and validate the request before admission to the four-job queue.
2. Load judge-only cases from SQLite; the browser receives explicit samples only.
3. Compile and execute each case in a fresh resource-limited container.
4. Compare output on the host; expected answers never enter the container.
5. Remove the container and store a terminal verdict, including infrastructure errors.

Fresh compilation per case intentionally favors isolation and simple recovery
over throughput. Reported milliseconds measure program execution, not queueing,
compilation or container startup. Wall-clock timings are illustrative, not a
fair contest benchmark across machines. The current comparison ignores leading
and trailing whitespace, but preserves whitespace inside the output.

## Tests

```sh
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Real Linux container tests (after building the image):

```powershell
$env:JUDGE_INTEGRATION = '1'
npm run test:docker --prefix backend
```

On Linux/macOS use `JUDGE_INTEGRATION=1 npm run test:docker --prefix backend`.
GitHub Actions runs both unit/API tests and real container checks: supported
languages, incorrect programs, infinite loops, excess output, descendants,
network isolation, controller protection and cross-case filesystem isolation.

## Data and recovery

The database is `backend/database.sqlite`. Existing problem/submission records
are preserved. On upgrade, a `samples` column is added with an empty default;
populate it with explicitly public `{ "input": "...", "output": "..." }` samples.
Existing judge-only cases are never automatically copied into public samples.
Back up the database with the server stopped before upgrading or editing it.

An interrupted job becomes Internal Error on restart. If Docker or cleanup
fails, repair/restart Docker, then restart the backend. A full queue returns a
retry message. There is no automatic host execution or hidden unsafe mode.
Source and verdict records currently remain in the local database; there is no
automatic retention deletion or multi-user account isolation.

The frontend includes loading, unavailable, empty and failed states; it cancels
polling on navigation and bounds network/polling waits. For a local production
preview, `npm run preview --prefix frontend` proxies `/api` to the loopback API.

## License

MIT. See [LICENSE](LICENSE).
