# Execution boundary

Brainsoft-OJ is an owner-operated local practice judge, not a public multi-tenant
judge service. The API binds to `127.0.0.1:5000`. Do not put it behind a public
reverse proxy or share the owner token with untrusted users.

Submissions are disabled unless `JUDGE_ENABLED=true`, a 32-byte-or-longer
`JUDGE_ACCESS_TOKEN` is configured, and the local Linux Docker engine and built
runner image are available. There is no host execution fallback.

Each test gets a new container. No host directory, Docker socket, token, database
or expected answer is mounted/passed into it. Source and that test's input arrive
over stdin. The container has no network, a read-only root filesystem, bounded
tmpfs, 512 MiB memory, one CPU, 64 PIDs and no privilege escalation. The trusted
controller retains only SETUID/SETGID/KILL capabilities to switch user and stop
the child process group; compiler and contestant
processes drop supplementary groups and run as UID/GID 10001. They cannot modify
the root-owned controller or write directly to its result pipe.

Compilation has a 10-second deadline; execution has a 2-second deadline and a
combined 64-KiB stdout/stderr limit. The controller kills the process group, and
the API forcibly removes the entire container afterward, including descendants
that changed their process group. Container/CLI failures disable further judging
until restart. Startup removes only containers with the project's worker label.
Use one server instance per Docker engine. Docker must be dedicated to this judge,
on a disposable VM without personal documents or unrelated services for hostile
code testing. Containers share a kernel; this is not a claim of VM-grade security.

The API admits four jobs including the running job, runs one at a time, accepts
64-KiB source and at most ten tests, and checks a 60-second overall budget between
test cases. The final case/cleanup may extend that budget by up to 30 seconds.
Normal judge exceptions produce `Internal Error`. A result storage failure stops
new judging and returns a service error instead of reporting endless `Pending`.
After restart, abandoned Pending/Running records become Internal Error.

Public problem responses contain explicit samples, never judge-only tests.
Submission status requires the same owner token and excludes submitted source and
runtime stderr. The frontend retains its token only in page memory. Monaco and
its worker are bundled locally instead of loaded from a CDN.

Before any public multi-user service: introduce separate authenticated owners,
per-user quotas, a separate runner host with a stronger sandbox/VM boundary,
operational monitoring, updates, retention policy and an independent security
review. Docker daemon access is privileged; never expose its API to contestants.

Sources: [Docker security](https://docs.docker.com/engine/security/),
[container resource restrictions](https://docs.docker.com/engine/containers/run/).

Report a security problem privately to the repository owner's profile email;
include a minimal reproduction and avoid posting credentials or private data.
