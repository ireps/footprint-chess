# Security policy

## Supported versions

Only the latest commit on the `main` branch is supported. That is the version GitHub Pages serves.

## Reporting a vulnerability

Report it privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue.

This is a personal project maintained by one person. Reports are handled on a best-effort basis.

## Security design

The app is a static site. It has no server-side code, no accounts and no data sent anywhere.

- **Content Security Policy.** Every HTML page sets a policy in a `<meta>` tag. It allows scripts, styles, images, fonts, media and connections only from the site's own origin. It blocks plugins (`object-src 'none'`), changes to the base URL (`base-uri 'none'`) and form submissions (`form-action 'none'`).
- **No inline code.** HTML contains no inline scripts, event handlers or style attributes, so the policy does not need `'unsafe-inline'` or `'unsafe-eval'`.
- **No third-party code.** No CDNs, analytics, advertising, web fonts or embeds are loaded.
- **No dependencies.** Tests use only Node.js built-in modules.
- **Safe DOM updates.** The code uses `createElement` and `textContent`. It does not use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
- **Referrer policy.** `no-referrer` is set on every page.
- **Local storage only.** The app sets no cookies. Progress, children's pictures and optional names, and the grown-up settings are kept in the browser's local storage on the device, under one key, and are never sent anywhere. See [PRIVACY.md](PRIVACY.md).
- **Service worker.** `sw.js` keeps the site's own files in cache storage for offline play. It only answers GET requests for the site's own origin, caches only the fixed file list written by `tools/make-offline.js`, never caches responses from elsewhere, and deletes older versions of its cache when a new one is complete.
- **Stored data and backup codes are untrusted.** Local storage can be edited, corrupted or written by a newer version, and a backup code is text a person pastes in. `js/store.js` rebuilds the whole document field by field from known keys and allowed values on every load and import (names have control and direction characters removed and are length-limited; ids, themes, languages, piece types, path steps and counts are checked; prototype keys are refused). A code carries a checksum and a version, and a code from a newer version, or stored data from one, is refused without being overwritten. Nothing stored or pasted is ever treated as markup: it is shown only through `textContent`.

## Known limitations

GitHub Pages does not let a repository set HTTP response headers. As a result:

- `frame-ancestors` cannot be used, because browsers ignore it in a `<meta>` tag. Other sites can therefore load the app in a frame. The app has no accounts or actions that such framing could abuse.
- Headers such as `Permissions-Policy` and `X-Content-Type-Options` are whatever GitHub Pages sends. They cannot be changed from this repository.

The target tablet runs Android 5.1 with a browser that no longer receives full security updates. Use the tablet for this app and similar content only, and do not sign in to personal accounts on it.

## Rules for changes

- Keep the Content Security Policy `<meta>` tag first in `<head>` on every page. Do not add `'unsafe-inline'`, `'unsafe-eval'` or other origins.
- Do not add third-party scripts, stylesheets, fonts, images or network requests.
- Do not use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`.
- Never commit secrets, access tokens or personal information. The repository is public.
- Do not collect or store anything about the child beyond what [PRIVACY.md](PRIVACY.md) describes. Update that file in the same change if this ever changes.
- Treat everything read from local storage or a backup code as untrusted: go through `js/store.js`, never parse it elsewhere.
