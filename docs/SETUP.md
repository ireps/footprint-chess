# Setup

## Publish with GitHub Pages

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose branch `main` and folder `/ (root)`, then save.
3. Wait for the first deployment to finish. The **Actions** tab shows its progress.
4. Back in **Settings > Pages**, turn on **Enforce HTTPS** if it is not already on.
5. The site is at https://ireps.github.io/footprint-chess/.

The repository includes an empty `.nojekyll` file, so GitHub serves the files as they are, without running Jekyll.

## Repository security settings

In **Settings > Code security** (the page name can vary slightly):

- **Private vulnerability reporting:** enable. [SECURITY.md](../SECURITY.md) relies on it.
- **Secret scanning** and **Push protection:** enable. Both are free for public repositories.
- **Dependabot alerts:** optional. The project has no dependencies.

In **Settings > Rules > Rulesets** (optional): add a ruleset for `main` that blocks force pushes and branch deletion.

For the GitHub account that owns the repository: turn on two-factor authentication.

## Check the tablet

1. On the tablet, open https://ireps.github.io/footprint-chess/check.html in Silk.
2. Check each row:
   - **Chromium version:** 108 is expected. Lower numbers may still work. Note the number if something breaks.
   - **Secure connection (HTTPS):** should be Yes.
   - **CSS grid, Pointer events, Web Animations, Web Audio:** all should be Yes.
   - **Speech voices:** note the number of English voices. Zero means spoken lessons will use recorded audio clips.
3. Tap **Play test sound** and **Test speech** and note what happens.
4. Open the game. Tap the rook card, then follow the lesson: tap the piece, then tap a footprint.

## Troubleshooting

**The page shows a certificate or security error.** Update Fire OS and Silk on the tablet, then try again. Android 5.1 does not trust some newer root certificates. This mainly affects custom domains, so keep using the `github.io` address.

**The board is cut off or very small.** Rotate the tablet. The layout adjusts to both landscape and portrait.

**There is no sound.** Tap the board once, because browsers block sound until the first tap. Check that the speaker button in the side bar is on, and check the tablet volume.

**Changes do not appear on the tablet.** GitHub Pages can take a few minutes to update. The app keeps its files on the tablet for offline play, so open it once online (it fetches the new version in the background), then reload the page in Silk to use the new version.

**The app does not open offline.** It must first be opened once with the internet on, over `https://` (the `github.io` address). The device check page shows whether the browser supports service workers.
