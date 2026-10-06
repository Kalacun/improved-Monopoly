# Cloudflare hosting, TV, and phone controllers

The computer runs the authoritative game server and stores the saves. Cloudflare carries HTTPS and WebSocket traffic to that computer. It does not move the game server or saves into the cloud. Players need only Safari, Chrome, Firefox, or Edge; no VPN, app installation, accounts, or port forwarding.

## Source setup

Install Node.js 24 LTS and cloudflared using its official download instructions. Mac users with Homebrew can use `brew install cloudflared`. Downloadable game packages include both tools; choose online hosting in their launcher instead.

```sh
cd path/to/estate-exchange
npm ci
npm run host
```

The command builds the client, starts the server (or reuses a compatible running production server), starts Cloudflare, and prints an `https://…trycloudflare.com` address when the tunnel connects. It automatically puts that address into the in-game invitations and QR codes. Keep this terminal open. **Control-C** closes the tunnel and any server it started; a reused server remains running. Saved games are retained. On macOS the launcher prevents idle sleep while running; keep the lid open and the computer plugged in.

Starting the host launcher again while it is already running displays a message and leaves the existing session untouched. A stale/older server on port 3000 must be stopped first with Control-C in its terminal. Do not run two servers against the same save directory. `PORT` selects a different port when necessary; `DATA_DIR` selects a separate save directory. `CLOUDFLARED_BIN` can point to a connector executable outside PATH.

Cloudflare Quick Tunnels need no account or domain. They give a new address each time the connector starts and have no uptime guarantee; Cloudflare describes them as testing/development tunnels. They support this game's WebSockets. For repeat game nights, use the permanent setup below.

## Family mode: TV board + one phone per player

1. On the hosting computer open **http://localhost:3000/?screen=tv**. Choose **TV + phones → Create family table**. The TV host does not occupy a player seat; 2–6 player seats remain available.
2. Show this browser window on your TV with **HDMI**, **AirPlay screen mirroring**, or **Chrome/Edge Cast tab** to a compatible TV/Chromecast. This is ordinary screen mirroring: the game does not pair with or remotely configure the television. HDMI is the most predictable option. Enable the TV's game mode if it has one and motion feels delayed.
3. Every player, including the person hosting, scans the displayed QR code with their phone camera. The HTTPS invitation works on Wi-Fi or mobile data. Enter a name and tap **Join table**. No account or native app is needed.
4. Names appear on the TV as people join. Set any special rules on the computer and click **Let's play** after everybody has joined. Players cannot join a new seat after starting, but existing seats can reconnect.
5. Phones show personal cash, current location, the next action, planning destinations, bidding, Portfolio, and Deals. They do not render/download the 3D board unless you choose **Table options → Show board on this device**. Phones may propose and accept deals during the usual action breaks.
6. The TV shows the 3D board, players, dice, next actor/bidder, and recent public events. It never receives pending offer terms. The **Full screen** button uses the browser's fullscreen API; the browser menu is a fallback.
7. On each phone, open **Table options → My seat recovery code** and save that code privately. Do this before closing the browser or restarting a temporary tunnel.

The TV host controls setup, game start, rule changes, and bot substitution. Players control only their own seats. A separate **read-only TV display** is available through the Invite dialog; it cannot roll, trade, start games, or alter rules. That display can also be opened in a TV browser, though mirroring the computer usually renders 3D more reliably.

## Online play without a shared TV

Run `npm run host`, open http://localhost:3000, and select **With friends → Host online table**. The host plays on the computer. Share **Invite → Copy invitation** with friends; they enter their names and join before starting. The invitation opens compact controls; **Table options → Show board on this device** restores a full board for a remote player. If the host wants to play on a phone too, use **TV + phones** instead.

Always share the complete invitation link or its QR code. The short table code alone is not sufficient for a new player: the invitation contains a random joining key. This also protects saved tables when the server is reachable over the Internet.

## Reconnection and resuming

- A transient lost connection reconnects automatically, including after a phone wakes. No turn is spent just because a phone disconnects. Use the same browser and invitation.
- The game saves on the host in `.data/rooms.json`; models and the launcher control key are also in `.data`. Keep this directory private and back it up with the server stopped.
- On the computer use **Resume table**. Since the computer uses localhost, its saved host seat continues to work after a tunnel's public address changes.
- Phones need the **new QR/invitation** after a Quick Tunnel restart. Browser credentials are tied to a web origin, so on a new address choose **Returning player? Recover your seat** and enter your 12-character recovery code. This restores the existing player, money, properties, and contracts without allocating another seat.
- If the public address stays the same, the browser remembers your seat automatically. Each family member should use their own device/browser. Tabs in the same browser share a saved seat.
- The host can temporarily assign a disconnected player to a bot in Table options, and release bot control when that player returns.
- Do not share recovery codes: each restores that seat's authority. The QR contains only the invitation, never a seat or host recovery code.

## Permanent Cloudflare address (recommended for regular use)

This requires your own Cloudflare account and a domain managed by Cloudflare. No account or domain was configured automatically.

1. Follow Cloudflare's **Create a tunnel (dashboard)** guide. Create a remotely managed Cloudflare Tunnel using the `cloudflared` connector.
2. Add a published application/public hostname, for example `estate.your-domain.com`. Set the service to **HTTP**, URL **127.0.0.1:3000**. If you change PORT, change this destination too. HTTPS is supplied at the Cloudflare edge.
3. Obtain that tunnel's connector token from the dashboard. Set `TUNNEL_TOKEN` and `PUBLIC_URL` in the terminal, then use the named launcher. Do not paste the token into a game invitation or commit it to the project.

```sh
export PUBLIC_URL=https://estate.your-domain.com
read -s 'TUNNEL_TOKEN?Paste your tunnel token: '
export TUNNEL_TOKEN
npm run host:named
```

The hidden-input command above is for the Mac's default zsh. The launcher passes the token through the environment, not the command line. `npm run host:named` runs the already-configured tunnel; it does not create the Cloudflare account, domain, DNS record, or tunnel. Keep WebSockets enabled for the hostname and do not add caching rules for `/api/*` or `/ws`. If you protect the hostname with Cloudflare Access, your family must also satisfy that Access policy.

For Windows PowerShell, install `cloudflared` with `winget install --id Cloudflare.cloudflared`, reopen the terminal, and run the same `npm ci` / `npm run host` commands from the project folder. Named hosting reads `$env:PUBLIC_URL` and `$env:TUNNEL_TOKEN`. Keep the PC awake while hosting; automatic idle-sleep prevention is provided only on macOS.

## Same-Wi-Fi fallback

Internet and Cloudflare are optional for everyone on the same reachable Wi-Fi. Run `npm run build` followed by `npm start`, create a TV + phones table, and use its local QR code. The invitation then uses the computer's LAN address. Guest Wi-Fi/client isolation may block connections; choose the normal home network and allow Node incoming connections if macOS asks. Cellular clients need Cloudflare. In all modes the host must stay on: there is no host migration or cloud-hosted game simulation.

## Verification and limits

`npm test` checks game and camera behavior. `npm run test:network` exercises normal multiplayer and save/restart behavior. `npm run test:party` starts an isolated server and tests the seatless TV, invitation and role enforcement, phone deals, recovery, synchronization, and heartbeats. Set `TEST_REMOTE_URL` to an active tunnel origin to run the party protocol test through real HTTPS/WSS; it creates a separate test table.

Physical TV casting, every Android/iPhone model, and permanent Cloudflare account configuration require testing in your own environment. Cloudflare may occasionally restart WebSocket connections; the client reconnects. A Quick Tunnel is a convenience for trying the game, not a permanent hosting guarantee.

Official references: [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/), [connector installation](https://developers.cloudflare.com/tunnel/downloads/), [WebSockets](https://developers.cloudflare.com/network/websockets/), [permanent tunnel setup](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/).
