# Privacy

Footprint Chess is made for young children. It has no accounts, no cookies, no analytics and no advertising, and it sends nothing about the child anywhere.

## What is stored on the device

Since stage 5 the app remembers progress, so a child can pick up where they left off. It stores, for each child (up to four), in this browser's local storage on this device:

- The child's picture (a piece, a theme and a ring colour) and an optional name that a grown-up may type in the grown-ups' corner.
- Progress: which lessons (and tips after a game) have been seen, which pieces have been played, stickers earned, the state of the capture jar, which team was picked in each theme, which games have been won in each theme, and the language and theme the child last chose.

It also stores the grown-up settings: calm mode, and the break reminder (on or off, and its length).

All of this is kept in one item of local storage, under the key `footprint-chess`. The app never asks for a name, and no name is needed to play.

For offline play the browser also keeps a copy of the app's own files (pages, styles, scripts and voice clips) in this site's cache storage, through a service worker (`sw.js`). That copy is the same for everyone and holds nothing about the child.

## What is not stored or sent

- Nothing is sent anywhere. The data stays in the browser on this device.
- There are no cookies, no logins, no analytics and no advertising.
- The app only loads its own files from the site, including lesson voice clips when they are needed. It makes no requests to other sites.

## The backup code

The grown-ups' corner can show a backup code, so that progress can be moved to another device by copying the code by hand. The code contains the same data as above, including any names, and it is not encrypted. Share it only between your own devices. The app never sends the code anywhere.

## Deleting the data

- In the grown-ups' corner, "Clear all progress" removes every child and all progress from this browser. A single child can be removed with "Remove".
- Clearing this site's data in the browser settings also deletes everything.

## Other notes

- The app has two languages, English (default) and Telugu. Switching languages sends no request anywhere. The choice is saved for the child who made it, as part of the data above; `?lang=` in the address also selects a language for that visit.
- If a voice clip is not available, the app may use the device's built-in speech to read the fixed lesson line aloud, in whichever language is selected. On some devices, depending on their settings, the speech engine may send that text to its provider. The text is the same short lesson line for every child and contains nothing about the child.

## Hosting

The files are served by GitHub Pages. GitHub records standard request data, such as IP addresses, as the host. See the GitHub Privacy Statement. The app adds no tracking of its own.
