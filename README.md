# Estate Exchange

**Own a little. Negotiate a lot.**

A free 3D Monopoly-inspired property-trading game where the best deal is rarely just “my property for your cash.” Sell a district and keep a share of its rent. Fund someone else's buildings in return for a stake. Reserve a future purchase at today's price—and decide whether to exercise it before inflation catches up.

Estate Exchange brings the familiar square board, classic US property names, roll, buy, auction and build rhythm to a new kind of property game. Then it gives players more ways to bargain, plan and recover. Play against computer opponents, gather around one screen, or put the board on your TV while everyone makes decisions on their phone.

**2–6 players · Windows, macOS and Linux hosts · browser-based guests · English and Slovenian · no paid subscription**

## Why spend a game night here?

- **Deals that keep mattering.** Rent shares, ownership stakes, purchase options, resale payments, buyer restrictions and investor loans turn a trade into a relationship.
- **A city you can read.** Properties take on a light shade of their owner's figure color. Click a site to see rent, development and contractual obligations. Gentle camera following keeps the active figure in view.
- **Luck with room for a decision.** Save limited planning credits to move one space less or more after a roll. Auctions and visible economic cycles give you something to work with when the dice disappoint.
- **A chance to come back.** Optional progressive property taxes and recovery grants soften runaway leads without taking away the leader's investments.
- **Your table, your rules.** Every economic module and every contract type has its own toggle. Start with the core game, then add complexity when your group wants it.
- **Your own pieces.** Bring a model you made, or choose a drone, lighthouse, fox, comet, crystal or robot. STL, OBJ, GLB and embedded glTF are supported.
- **A soundtrack that follows the stakes.** Calm music gives way to trading energy or debt tension. Magenta composes melodies locally; no AI account or API key is needed.

Imagine selling a property for $300 while keeping 20% of its rental income. You get money to survive now, your buyer gets the title, and both of you care about developing the neighborhood. That is the kind of negotiation Estate Exchange is built for.

## Choose how to play

| Mode                       | What you need                                                                   | Best for                                                    |
| -------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Solo**                   | One computer; a browser                                                         | Learn with computer opponents                               |
| **Pass-and-play**          | One computer shared by human seats                                              | Everyone around the same screen                             |
| **Same-Wi-Fi multiplayer** | One host computer; each guest's phone or computer on the same reachable network | Local play without Internet after setup                     |
| **Online with friends**    | One host computer with Internet; guests use an invitation in their browser      | Friends in different homes; no VPN or port forwarding       |
| **TV + phones**            | One host computer displayed on a TV; one phone per player                       | Family game night with a shared board and personal controls |
| **Read-only display**      | An additional browser opened through Invite                                     | A second TV/spectator screen without player controls        |

Only the host needs to download the game. Guests open an invitation in a current browser. The host runs the game and keeps the saves; Cloudflare provides a connection to that computer, rather than running the game in the cloud. Keep the host awake and the launcher open while playing.

## Easiest installation: download, extract, play

Once the maintainer has published a release, open this repository's **Releases** page and download the **Estate Exchange ZIP** for your computer. GitHub's automatically generated “Source code” ZIP is for the separate source setup below; it does not contain the bundled runtime.

Each game package contains the built game, Node.js runtime, Cloudflare connector, music model, sounds and fonts. **No npm, Node installation, game engine or Blender installation is required.** A current browser and a computer capable of WebGL 3D rendering are required. Internet is needed for online hosting, but local and same-Wi-Fi games can run offline.

| Your computer                                 | ZIP name ends with | How to start after extracting                            |
| --------------------------------------------- | ------------------ | -------------------------------------------------------- |
| Mac with Apple silicon (M1, M2, M3, M4, etc.) | `darwin-arm64.zip` | Double-click **Play.command**                            |
| Mac with an Intel processor                   | `darwin-x64.zip`   | Double-click **Play.command**                            |
| Windows on Intel/AMD, 64-bit                  | `win32-x64.zip`    | Double-click **Play.cmd**                                |
| Linux on Intel/AMD, 64-bit                    | `linux-x64.zip`    | Open a terminal in the extracted folder; run `./Play.sh` |
| Linux on ARM64                                | `linux-arm64.zip`  | Open a terminal in the extracted folder; run `./Play.sh` |

On a Mac, **Apple menu → About This Mac** shows “Chip” or “Processor.” On Windows, **Settings → System → About → System type** shows the architecture. There is no native Windows ARM or 32-bit package; use the source route on a supported Node platform instead. Modern Node 24-compatible operating systems are needed; old systems may not run the bundled runtime.

1. Download the matching ZIP.
2. **Extract the entire ZIP** into a normal folder. On Windows, right-click → **Extract All**. Do not launch it from inside the ZIP.
3. Open the launcher listed above. A text window offers four choices:
   - `1`: this computer / same Wi-Fi;
   - `2`: friends online;
   - `3`: TV + phones on the same Wi-Fi;
   - `4`: TV + phones online.
4. Type the number and press Enter. Your browser opens when the server, or online tunnel, is ready. If it does not open, use **http://localhost:3000**; for TV use **http://localhost:3000/?screen=tv**.
5. Leave that text window open. **Ctrl+C** stops hosting. Saved games remain on the host.

These are portable launchers, not signed app-store installers. macOS or Windows may ask you to confirm an unfamiliar download. Check that it came from this repository's release before following your operating system's normal approval flow. On Linux, if executable permissions were lost during extraction, run `chmod +x Play.sh runtime/node runtime/cloudflared`, then `./Play.sh`. On Mac, the source setup below is also available if the downloaded launcher is blocked.

**Release availability:** the repository contains a packaging script and GitHub workflow. Packages appear in Releases only after a maintainer builds and uploads them. See [Publishing on GitHub](docs/GITHUB.md).

## Your first game, step by step

1. Choose **English** or **Slovenščina** in the header. Every browser can choose its own language.
2. Choose **This computer**, **With friends**, or **TV + phones**.
3. Enter your name and create a table. A local table includes computer opponents. Change seats from **AI** to **Human** for pass-and-play, and add/remove seats before starting. A game needs at least two players.
4. Choose **Core** for an introduction, or **Economy edition** for the full experience. Turn off any special rule your group does not want. **Tune the numbers** stays collapsed until you open it.
5. Pick your figures, let friends join, then press **Let's play**. Join all new players before starting; existing seats can reconnect later.
6. Follow the **Turn** tab. It always tells the player what is needed next: roll, choose movement, buy, bid, settle a bill or end the turn.

**A good first Economy game:** keep planning credits, visible cycles, property tax and recovery grants. Start with ordinary trades and rent shares. Try loans and options once everyone understands the board. For a gentler long game, set inflation to 2–5%; the default 10% is intentionally dramatic.

Computer opponents handle rolls, purchases, bidding, development, mortgages, debt and simple cash/property trades. They do **not** evaluate advanced contracts. Play with human partners to explore the investor features.

## How a turn works—and how you win

The opening dice contest chooses who starts; turns then follow seating order. Each player begins with $1,500. Move around the 40-space city and collect $200 when passing **GO** (indexed in Economy mode).

1. **Roll two dice.** With planning enabled, keep the result for free or spend one credit to move one space less or more.
2. **Resolve your destination.** Buy an available property, pay rent to its owner, pay a levy, draw a Chance/Community Chest card, or follow the site's instruction. Payments and card effects resolve automatically.
3. **If you decline a purchase, it goes to auction.** Everyone eligible can bid, including you. Bidding proceeds in order; passing is final for that auction. You may mortgage eligible assets to fund a bid.
4. **Manage and negotiate between actions.** Inspect your Portfolio, develop complete color groups, mortgage eligible titles, offer deals, or accept another player's proposal.
5. **End your turn** when the Turn tab allows it. Doubles normally earn another roll. Three consecutive doubles send your figure to **Review**.

The winner is the last solvent player. If you cannot pay a bill, use the debt controls to sell buildings, mortgage eligible titles or negotiate funds. Bankruptcy transfers remaining assets to the creditor or triggers bank auctions. You cannot simply ignore an unaffordable payment.

### Development, Review and cards

- Owning a complete color group doubles its undeveloped rent. Build evenly across the group: up to four houses, then a hotel. The bank has 32 houses and 12 hotels; scarcity can trigger a building auction.
- Buildings sell for half their indexed base cost. Group buildings must be removed before a mortgage or title transfer.
- A mortgaged property earns no rent. Redeem it by paying principal plus interest. Taking a mortgaged title from another player also incurs immediate transfer interest.
- Review temporarily holds your figure. Rent and trading still work. Leave using a release certificate, a $50 fee, or a successful doubles roll; the third unsuccessful attempt requires payment. Review escape rolls cannot use planning credits and do not earn an extra doubles roll.
- **Free Parking** is a rest space, with no cash jackpot.
- Chance and Community Chest use the classic US card effects. Their descriptions use concise project wording; the drawing player can read each card while its effect resolves once. The card disappears from the turn panel after that turn ends, and **Read recent cards** remains available.

For the exact settlement rules, restrictions and digital-table conventions, see [the rules guide](docs/RULES.md).

## The investor toolkit

Open **Deals**, choose another player, select properties/cash and add the terms you want. The recipient reviews the proposal and chooses whether to accept. Accepted deals are checked against the current state; stale or invalid offers cannot partly transfer assets. Inspect a property to see its continuing obligations.

| Rule                                   | What you can agree                                                                                                  | Why it changes the game                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Rent share / royalty**               | Retain a percentage of a property's collected rent after selling it                                                 | Trade current cash for future income; keep a reason to support the buyer       |
| **Ownership stake / portfolio equity** | Buy shares in one or several properties; share rent and later sale proceeds while another player retains the titles | Diversify and fund development without needing a whole district                |
| **Purchase option**                    | Reserve a future purchase at a fixed price, without expiry                                                          | Timing matters when prices rise; an upfront premium can compensate the grantor |
| **Sell-on payment**                    | Specify a fixed payment to the former owner at each later voluntary sale                                            | Reward someone who gives an early discount                                     |
| **Resale restriction**                 | Prevent a title being sold to named players while the beneficiary remains solvent                                   | Make a strategic sale without immediately enabling a rival's district          |
| **Investor loan**                      | Lend cash at 0–25% fixed interest, due after 1–5 of the borrower's GO crossings                                     | Bridge a shortage now, but face a visible repayment deadline                   |

Income shares on a title together are capped at 80%. Options reserve titles against sale, new mortgages and group development. Loans do not recursively compound. Some beneficiary rights end on bankruptcy; bank foreclosure clears attached clauses. Read the [contract examples](docs/RULES.md) before trying a complicated deal.

### An economy you can plan around

- **Inflation:** prices, rents, construction, ordinary bills and GO salary rise after **every surviving player** completes a shared lap. Cash and already-agreed fixed prices remain nominal. It does not increase after each individual player crossing.
- **Visible cycles:** steady market → cheaper building → stronger rents → tighter credit → recession. These phases repeat predictably rather than arriving as random shocks.
- **Progressive real-estate tax:** the default 4% applies at GO to property wealth above the table median plus an indexed $500 allowance.
- **Recovery grant:** the default indexed $75 is paid at GO when net worth is below 75% of the surviving players' median.
- **Planning credits:** start with 2, gain 1 every 2 personal laps, cap 3. A credit buys a ±1 movement choice after an ordinary roll. For scarcer credits, use **1 starting credit / 5 laps per refill** under **Tune the numbers**.

Use each rule's toggle before starting. During play, the host can change rules through **Table options → Special rules checklist**. Changes govern future events; signed agreements remain binding. Unsigned offers are cleared when settings change. The core purchase auctions stay enabled.

## TV + phones: the family setup

1. Start the packaged launcher in mode `3` (same Wi-Fi) or `4` (online). From source, use `npm start` or `npm run host`, then open **http://localhost:3000/?screen=tv**.
2. Connect the computer to the TV using **HDMI**, screen mirroring/AirPlay, or a compatible browser's Cast feature. HDMI is usually the easiest. The game supplies the display page; your computer handles mirroring.
3. On the computer choose **TV + phones → Create family table**. The TV host takes **no player seat**, leaving all six available.
4. **Every player, including the host**, scans the TV's QR with their phone camera. Open the invitation in a browser, enter a name and join. No phone app or account is required.
5. Set the rules on the computer and start once everyone appears. The computer displays the city; phones provide personal turn controls, movement choices, bidding, portfolios and deals.
6. Music starts after a click or keypress on the computer. Select the TV as its audio output if necessary. Phones start quiet so the room hears one soundtrack.
7. Save each phone's **Table options → My seat recovery code** privately before restarting an online session.

Same-Wi-Fi mode requires a reachable home network; guest Wi-Fi often isolates devices. Online mode uses Cloudflare, so phones can join over Wi-Fi or mobile data. Keep the computer awake, plugged in, and its lid open. macOS online hosting includes an idle-sleep guard; Windows/Linux sleep settings are your responsibility.

For a second display, use the read-only TV link in **Invite**. For a remote player who needs their own board, choose **Table options → Show board on this device**.

## Camera, names, figures and audio

**Board controls:** left-drag to rotate, right-drag or Control-drag to pan, wheel to zoom. On touch screens, use one finger to orbit and two fingers to pan/pinch. North/East/South/West buttons give clean cardinal views. **Follow turn** follows the active figure around the city's four sectors; manual movement pauses it. Use **Follow turn** again to resume. Reduced-motion preferences are respected.

**Names:** use **Rename player**, or **Table options → Rename player**, during the game. Pass-and-play uses **Controlling** to select whose portfolio and offers you manage.

**Figures:** select the piece button in the lobby or **Table options → Change or import your figure** during play. Imports are limited to 8 MB and 500,000 vertices, centered and sized automatically, and shared with the connected table.

| Format | What to export                                                               |
| ------ | ---------------------------------------------------------------------------- |
| STL    | ASCII or binary; Z-up; gets a player-colored metal material                  |
| OBJ    | Geometry/normals, Y-up; external MTL/textures are not loaded                 |
| GLB    | Recommended for textured figures; self-contained, uncompressed glTF binary   |
| glTF   | Embedded data-URI buffers/images only; external companion files are rejected |

Draco/KTX2/Meshopt compression and animation playback are not supported. Only import files you have permission to share. Blender is optional if you want to make figures; the game does not need it.

**Audio:** desktop/TV music and effects are on by default and start with your first interaction, as browsers require. Use **♫ Sound** to mute, toggle music/effects separately, adjust volumes or disable AI melodies for lighter ambient music. Preferences are per device and remembered. The music director uses public game state and events to steer a local melody model; no player names or chat are sent to an AI service. If it cannot load, ambient music continues. See [audio details](docs/AUDIO.md).

## Install from source: macOS, Windows or Linux

This route is for people who want to edit the game or cannot use a release package. Only the host does this; guests still need just a browser.

### 1. Install Node.js once

Install **Node.js 24 LTS** from [nodejs.org](https://nodejs.org/en/download). npm comes with Node. The project minimum is Node 22.12. Use a supported modern 64-bit operating system and current browser with hardware acceleration.

- **Mac:** download the macOS installer, open it and complete installation.
- **Windows:** download the Windows installer, install it with npm included, then open a new PowerShell or Command Prompt window.
- **Linux:** follow Node's official instructions for your distribution. A distribution's older Node package may not meet the requirement.

In a new terminal run `node --version` and `npm --version`. Both should print a version. On Windows, if PowerShell blocks `npm.ps1`, use **Command Prompt** or type `npm.cmd` instead of `npm`; no system-wide policy change is needed.

### 2. Download and open the project folder

On this repository click **Code → Download ZIP**, extract it, then open a terminal **inside the extracted folder** (the one containing `package.json`). On Windows, open the folder in Explorer and type `cmd` in the address bar. On Mac/Linux, use Terminal and `cd` to that folder; you can drag the folder into the Mac terminal to insert its path after `cd `.

### 3. Run these commands, one line at a time

```sh
npm ci
npm run build
npm start
```

Wait for each command to finish before entering the next. Open **http://localhost:3000**. Leave the terminal open. `npm ci` installs dependencies; `build` prepares the browser game; `start` hosts it. After the first setup, use `npm start` for local play. Rebuild after updating source code.

`start.command` is an optional Mac source launcher: it installs dependencies when needed, builds and starts the game. It still requires Node. The downloadable release launcher is the route that avoids installing Node/npm.

### 4. Add Internet play, if wanted

The source route also needs Cloudflare's connector:

- **Mac with Homebrew:** `brew install cloudflared`; without Homebrew, follow the official download instructions.
- **Windows:** `winget install --id Cloudflare.cloudflared --exact`, then reopen your terminal.
- **Linux:** use Cloudflare's [official installation instructions](https://developers.cloudflare.com/tunnel/downloads/) for your distribution/architecture.

Then, from the project folder:

```sh
npm run host
```

Wait for **ONLINE: https://…trycloudflare.com**. Open localhost, create a **With friends** or **TV + phones** table, and share its complete invitation/QR. There is no need for a Cloudflare account, a domain or a VPN for a temporary Quick Tunnel. Quick Tunnels have no uptime guarantee and their address changes after restart; [Cloudflare describes them as a testing convenience](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

For a stable address with your own Cloudflare account/domain, see [permanent hosting](docs/HOSTING.md). GitHub Pages cannot host this authoritative WebSocket server.

## Saves, reconnection and privacy

Games autosave on the host. Use **Resume table** to return. A temporarily disconnected phone reconnects automatically; no turn is consumed by disconnecting.

| Installation    | Default private save folder                                           |
| --------------- | --------------------------------------------------------------------- |
| Source          | `.data` inside the project                                            |
| Mac package     | `~/Library/Application Support/Estate Exchange`                       |
| Windows package | `%LOCALAPPDATA%\Estate Exchange`                                      |
| Linux package   | `$XDG_DATA_HOME/estate-exchange`, or `~/.local/share/estate-exchange` |

A temporary Cloudflare URL changes when the tunnel restarts. Phones should scan the **new** invitation, choose **Returning player? Recover your seat**, and enter their private 12-character recovery code. On the same origin/browser, the seat is remembered automatically.

Stop the server before backing up its entire save folder. Source and packaged installs use different default folders. To move a game, stop both servers and copy the entire source `.data` contents to the package's save folder; do not overwrite unrelated saves. `DATA_DIR` can select another folder. Uploaded figures and credentials live there too. **Never upload this folder, invitations, recovery codes or tunnel tokens to GitHub.**

## If something does not work

| Problem                                    | What to do                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Address already in use” / port 3000 busy  | If the game is already running, open localhost. Otherwise stop the other program or choose another port; do not repeatedly start copies                         |
| Use another port from source               | Mac/Linux: `PORT=3001 npm start`. PowerShell: `$env:PORT=3001` then `npm start`. Command Prompt: `set PORT=3001` then `npm start`. Open `http://localhost:3001` |
| Phone cannot join                          | Share the complete invitation/QR. Same-Wi-Fi mode needs a reachable home network and host firewall access; use online mode for cellular/remote guests           |
| QR has a local address during online setup | Wait for ONLINE, then reload the host page and create/share the invitation                                                                                      |
| Black/empty 3D board                       | Update the browser, enable hardware acceleration, try another current browser; compact phone controllers can play without rendering the board                   |
| No music                                   | Click the computer page once; check saved mute/music settings, OS/TV volume and output device. Keep the game tab visible                                        |
| Double soundtrack                          | Mute other devices; keep audio on the TV computer only                                                                                                          |
| Model fails or computer is slow            | Disable AI-composed melodies; ambient music and the game continue                                                                                               |
| Session vanished after tunnel restart      | Use Resume on the host and the new invitation plus your saved seat recovery code on phones                                                                      |
| Host closes or sleeps                      | Guests lose access until it returns. There is no host migration or always-on cloud game server                                                                  |

## For contributors and maintainers

Built with TypeScript, Three.js and an authoritative Node/WebSocket server. Random rolls, payments, contracts and game state are resolved on the host; clients cannot act for other seats. Future deck order and random state are concealed. Bots are basic opponents; economic balance still benefits from human playtesting.

```sh
npm run dev           # Development server with browser hot reload
npm run check         # TypeScript validation
npm test              # Rules, localization, camera, audio and full bot games
npm run test:network  # Isolated multiplayer and save/rejoin checks
npm run test:party    # Isolated TV, phone, role and recovery checks
npm run models        # Regenerate the original figure exports
npm run release:check # Run the release checks
npm run package       # Build a ZIP for this computer's platform
```

Supported package targets: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`. Example: `npm run package -- win32-x64`. Packaging downloads official runtime/connector binaries and verifies their published SHA-256 hashes. The GitHub **Build downloadable game packages** workflow builds all five targets after verification. A generated package still needs platform smoke testing; it is not a signed/notarized installer.

Start with [the rules](docs/RULES.md), [hosting](docs/HOSTING.md), [audio](docs/AUDIO.md), [Slovenian translation](docs/SLOVENE.md), [release checks](docs/VERIFICATION.md), or [step-by-step GitHub publishing](docs/GITHUB.md).

## Free, independent and open source

Estate Exchange is distributed free of charge. Project-authored code and artwork use the [MIT License](LICENSE); third-party assets retain their licenses in [Third-party notices](THIRD_PARTY_NOTICES.md). MIT also allows others to reuse or sell their own derivatives.

This is an independent, Monopoly-inspired game with its own name, central board artwork and figures. It uses the familiar US property names and classic Chance/Community Chest effects, with additional investor and economy rules. It is not affiliated with, sponsored by or endorsed by Hasbro or another publisher, and it does not include their logos or printed card artwork. See [Public-release notes](docs/PUBLIC_RELEASE.md) for the project's release considerations.
