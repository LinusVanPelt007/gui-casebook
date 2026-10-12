# Local source build

The bundled app in the parent folder is ready to run with Node.js 22.13 or newer.
No npm install or build is needed for normal use.

To edit and rebuild:

1. Stop the app and back up the parent `data` folder.
2. Open a terminal in this source folder.
3. Run `npm install` (internet required only for this development setup).
4. Edit `app/studio.tsx`, its CSS, the entry validators in `lib/`, or `server/`.
5. Run `npm run build`. This rebuilds ../public and ../server.mjs.
6. Run the launcher in the parent folder.

To make the download zips (Node bundled, nothing for students to install):

1. Run `npm run build`, then `npm run release`.
2. Upload the three zips in `../../release/` to a new GitHub release.

Data files stay outside source and are not replaced by builds.
The build uses bundled frontend assets and native Node SQLite/file storage.
The local auth adapter identifies one local operator; it is not multi-user auth.

`server/main.mjs` serves the app on loopback only and blocks hostile origins.
`server/storage.mjs` owns SQLite and filesystem storage.
`app/api/[...path]/route.ts` owns entry operations and exports.
`lib/workbook.ts` preserves OOXML workbook parts while applying edits.

This source has no Sites or Cloudflare runtime dependency. The source store
imports an environment binding that is mapped to the local storage adapter
at build time. Local identity is mapped to server/local-auth.mjs.
