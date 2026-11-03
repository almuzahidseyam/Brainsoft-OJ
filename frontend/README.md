# Brainsoft-OJ frontend

React/Vite UI for the local judge. Follow the [root setup guide](../README.md).

`npm run dev` and `npm run preview` listen on loopback and proxy `/api` to
`127.0.0.1:5000`. The editor and its worker are bundled locally. Access tokens
stay in page memory; there is no localStorage credential persistence.

Run `npm test`, `npm run lint`, and `npm run build` before committing changes.
