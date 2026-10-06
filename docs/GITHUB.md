# Put Estate Exchange on GitHub and publish playable downloads

## 1. Create the private repository in the browser

1. Sign in to GitHub and open [New repository](https://github.com/new).
2. Select your own account, name it **estate-exchange**, and choose **Private**.
3. Suggested description: “Free 3D property-trading game with investor contracts, a changing economy, and TV + phone multiplayer.”
4. Leave **Add a README**, **Add .gitignore** and **Choose a license** unchecked: this project already supplies those files.
5. Click **Create repository**. Copy its HTTPS URL. Do not paste a token into that URL.

## 2. Upload the project from your Mac

The browser's folder upload is unsuitable for installed dependencies and may accidentally include private files. Use Git so the supplied `.gitignore` is applied. GitHub Desktop is an alternative if you prefer a graphical application.

In Terminal:

```sh
cd path/to/estate-exchange
git init -b main
git status --short
```

If Git is unavailable, install Apple's Command Line Tools using `xcode-select --install`, complete installation, then retry. Before staging, ensure `.data`, `.env` files, `node_modules`, `release` and `.release-cache` are absent from the status. The project excludes them. `.gitignore` cannot protect a secret you manually put into another tracked file.

```sh
git add .
git diff --cached --stat
git status --short
```

Review the list. It should contain source, docs, licensed public assets and package files, **not** saved rooms, uploaded user figures or credentials. To unstage a mistakenly added folder before the first commit, use `git rm --cached -r FOLDER`; this retains local files. Fix the exclusion before continuing.

```sh
git commit -m "Prepare Estate Exchange for public release"
git remote add origin https://github.com/YOUR-USERNAME/estate-exchange.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username, or use the exact copied repository URL. Authentication should use GitHub's credential manager/browser flow, SSH, or a personal access token entered only into the credential prompt. GitHub account passwords do not authenticate Git HTTPS pushes. Never put a token into code or commit messages. If Git requests an author identity, configure your name and a GitHub-provided private/noreply email before committing.

**GitHub Desktop alternative:** add this existing local Git repository, commit the reviewed files, then **Publish repository**, with **Keep this code private** checked. Do not create a second different repository with the same name if you already created one on the web; add the existing remote instead.

## 3. Build downloadable packages on GitHub

1. Open the repo's **Actions** tab. Enable Actions if GitHub asks.
2. Select **Build downloadable game packages**.
3. Click **Run workflow**, choose `main`, and run it.
4. Wait for verification and the five platform builds to finish.
5. Open the completed run. Download each artifact: Apple silicon Mac, Intel Mac, Windows x64, Linux x64, Linux ARM64.
6. Extract the Actions artifact wrapper. Inside are the actual `estate-exchange-…zip` game package and its `.sha256` file. Upload those inner files as release assets; do not upload the wrapper ZIP.

This workflow uses read-only repository permissions and **does not publish anything automatically**. Private-repository Actions usage is subject to your account's allowance; check that allowance before repeated large builds. Package downloads are generated from current official Node 24 and cloudflared releases and record the exact versions/checksums.

## 4. Test, then publish a release

1. Test the Mac package locally without relying on your installed Node/npm. Have a trusted tester try the Windows and Linux packages; the workflow creates them but does not execute all platform binaries.
2. Test one local game, a TV + phones game, music/mute settings, reconnection and imported models. Review [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md).
3. Open **Releases → Draft a new release**.
4. Use a tag matching `package.json`, initially **v1.0.0**, and target `main`. Title: **Estate Exchange 1.0.0**.
5. Describe the original board, investor contracts, supported modes, changes and known limitations. Attach all five game ZIPs and corresponding checksums. Keep the release as a draft until ready.
6. Publish when ready. Private releases are accessible only to authorized repository users.

Players use the matching attached game ZIP. GitHub's automatic source archives do not bundle Node, cloudflared or the built game.

## 5. Make it public when ready

Review all tracked files **and Git history** before changing visibility. Removing a secret in the latest commit does not erase it from history; revoke exposed credentials and follow GitHub's removal guidance if one was ever committed. Saves have not been included by the package script.

On GitHub open **Settings → General → Danger Zone → Change repository visibility → Public** and complete GitHub's prompts yourself. The code, history and published releases will become publicly accessible. The repository name and marketing should use Estate Exchange, without another game's logo or brand as the product name.

Add topics such as `board-game`, `threejs`, `multiplayer`, `property-trading`, `family-game` and `typescript`. Pin a tested release and enable Issues for bug reports. A public GitHub repository distributes the project; it does not keep anyone's game server running. GitHub Pages cannot run this WebSocket server.

## Updates

Edit the game, run `npm run release:check`, bump the version in `package.json` and synchronize the lockfile with `npm install --package-lock-only`. Commit and push, run the workflow again, then draft a release with a new matching tag. Tell players to stop the old launcher before opening the new package. Package saves live outside the extracted folder, so ordinary version-folder replacement preserves them.

Official references: [create a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository), [ignore files](https://docs.github.com/en/get-started/git-basics/ignoring-files), [manage releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [change visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).
