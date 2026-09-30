# Setup

## Publish with GitHub Pages

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**. Choose branch `main` and folder `/ (root)`, then save.
3. Wait for the first deployment to finish. The **Actions** tab shows its progress.
4. Back in **Settings > Pages**, turn on **Enforce HTTPS** if it is not already on.
5. The site is at https://ireps.github.io/footprint-chess/.

The repository includes an empty `.nojekyll` file, so GitHub serves the files as they are, without running Jekyll.

## Repository settings

These are changed by the repository owner on GitHub; nothing in the repository can set them.

**Settings > General**

- **Description:** "A chess-learning web app for young children: footprints instead of left and right, animated lessons, no login, works offline." **Website:** the Pages address. **Topics:** chess, education, kids, offline-first, accessibility, telugu.
- **Features:** Issues on; Wiki off; Discussions optional; Projects off unless used.
- **Pull Requests:** allow merge commits (and squash merging if wanted); turn on **Always suggest updating pull request branches** and **Automatically delete head branches**.

**Settings > Rules > Rulesets:** add a branch ruleset for `main` (the default branch), enforced, with:

- **Restrict deletions** and **Block force pushes**.
- **Require a pull request before merging**, with 0 required approvals while there is one maintainer (GitHub does not let authors approve their own pull requests); raise it to 1 when there are co-maintainers. Turn on **Require review from Code Owners** at the same time.
- **Require status checks to pass**, adding the checks **test** and **browser** (from the Tests workflow, `.github/workflows/test.yml`; each appears in the list after the workflow has run once).

**Settings > Actions > General**

- **Actions permissions:** allow actions created by GitHub only (the workflow uses `actions/checkout` and `actions/setup-node`).
- **Approval for running fork pull request workflows:** require approval for first-time contributors.
- **Workflow permissions:** read repository contents permission (the default for new repositories); leave "Allow GitHub Actions to create and approve pull requests" off.

**Settings > Code security**

- **Private vulnerability reporting:** enable. [SECURITY.md](../SECURITY.md) and [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) rely on it.
- **Secret scanning** and **Push protection:** enable. Both are free for public repositories.
- **Code scanning:** set up CodeQL with the default setup (JavaScript).
- **Dependabot:** alerts are optional (the app has no dependencies); version updates can keep the workflow's actions current.

**Settings > Pages:** deploy from the `main` branch, folder `/ (root)`, with **Enforce HTTPS** on (see above).

**The owner's account:** two-factor authentication on, and **Keep my email addresses private** on (in the account's email settings), with git set to use the GitHub no-reply address for new commits.

## Check the tablet

1. On the tablet, open https://ireps.github.io/footprint-chess/check.html in Silk.
2. Check each row:
   - **Chromium version:** 108 is expected. Lower numbers may still work. Note the number if something breaks.
   - **Secure connection (HTTPS):** should be Yes.
   - **CSS grid, Pointer events, Web Animations, Web Audio:** all should be Yes.
   - **Speech voices:** note the number of English voices. Zero means spoken lessons will use recorded audio clips.
3. Tap **Play test sound** and **Test speech** and note what happens.
4. Tap **Test game speed** and wait for the result (up to a minute). It times the other side's moves and the hints in the two biggest battles. "Fast enough" means the opponent's longest move fits inside its thinking pause (600 ms) and the longest hint takes under a second; otherwise note the numbers.
5. Open the game. Tap the rook card, then follow the lesson: tap the piece, then tap a footprint.

## Troubleshooting

**The page shows a certificate or security error.** Update Fire OS and Silk on the tablet, then try again. Android 5.1 does not trust some newer root certificates. This mainly affects custom domains, so keep using the `github.io` address.

**The board is cut off or very small.** Rotate the tablet. The layout adjusts to both landscape and portrait.

**There is no sound.** Tap the board once, because browsers block sound until the first tap. Check that the speaker button in the side bar is on, and check the tablet volume.

**Changes do not appear on the tablet.** GitHub Pages can take a few minutes to update. The app keeps its files on the tablet for offline play, so open it once online (it fetches the new version in the background), then reload the page in Silk to use the new version.

**The app does not open offline.** It must first be opened once with the internet on, over `https://` (the `github.io` address). The device check page shows whether the browser supports service workers.
