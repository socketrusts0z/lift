# Lift

A private, on-device workout tracker. No account, backend, analytics, remote fonts, or cloud workout storage. GitHub Pages serves only the application files.

## Features

- Routines, custom exercises, exercise order and set targets
- Weight/reps, bodyweight reps, duration, and distance/time tracking
- Previous performance, rest timers, notes, warm-up/drop/failure labels
- Autosaved unfinished sessions, completed history and repeat workouts
- Exercise progress and working volume; kg/lb conversion and light/dark themes
- Full JSON backup/restore, portable history JSON, spreadsheet CSV export
- Installable PWA and cached offline application shell

## Use

Open the published HTTPS URL. On iPhone, use Safari → Share → Add to Home Screen. On Android, use Chrome → Install app. Visit once online before using offline. Your data belongs to this web address in this browser; a different device, browser, or domain has separate storage. The app ships with example routine templates but no fabricated workout history.

Export a JSON backup regularly from Settings. Clearing website data, removing browser storage, or private browsing can lose local data. Persistent storage is requested only through the Settings button. GitHub never receives your workouts.

JSON imports are validated and previewed. Merge adds unknown IDs and preserves local records, settings, and the current active session. Replace overwrites device data after confirmation. CSV is an export for spreadsheets; restore using JSON. Backups are unencrypted local files.

The rest timer uses a saved deadline and recalculates on resume. Exact alerts while the phone is locked are not guaranteed. No Apple Health or watch integration is included.

## Development

No dependencies or build step. Requires Node 20+ for tests and Python 3 for a local server.

```
npm test
npm start
```

Then open http://localhost:4173. Serve through HTTP or HTTPS, not file://. The application uses IndexedDB; the service worker caches only application assets. Browsers supporting Web Locks allow a single writer tab to prevent stale tabs overwriting data. Do not edit in multiple tabs on browsers without Web Locks.

For an app update, increment the shell cache name in sw.js. All tabs must close before a waiting service worker activates. Data stays in IndexedDB independently of the shell cache.

## Hosting

This app is published from the root of the main branch of `socketrusts0z/lift` with GitHub Pages. All asset paths are relative so repository subpaths work. `.nojekyll` prevents unnecessary processing. No credentials or private data belong in this repository.

## Data format

Version 1 JSON: `{schema:1, settings, customExercises, routines, workouts, active}`. Weights are stored in kilograms and distances in kilometers. Workouts snapshot exercise names and prescriptions so edits to routine templates do not rewrite history. Device storage is one atomic IndexedDB record, with serialized writes. Import validation rejects invalid numbers, malformed dates, duplicate IDs, and unsupported schemas.
