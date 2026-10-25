# Star-Delta Starter: Phone HMI

A web page that works as a phone HMI for a Siemens S7 PLC. You can start and stop a star-delta motor starter from your phone and watch the latch, star and delta lamps and the changeover timer live.

- **Frontend:** `index.html`, a single page that talks to the server with Socket.IO
- **Backend:** `server.js`, a Node.js server that reads and writes the PLC with [nodes7](https://www.npmjs.com/package/nodes7)
- **PLC:** S7-1200 / S7-1500 / S7-300 / S7-400, or a simulator (see [Requirements](#requirements))

## How it works

```
Phone (browser)  <--Socket.IO / HTTP-->  Node.js server  <--S7 protocol (port 102)-->  PLC
   START / STOP  --->  /start, /stop  --->  pulse M1.3 / M1.7
   lamps + timer <---  "update" event <---  read M12.0, M12.2, M12.3, MD14 (every 200 ms)
```

1. Pressing **START** or **STOP** calls `/start` or `/stop` on the server.
2. The server sets the PLC bit to 1 for 300 ms and then back to 0.
3. Every 200 ms the server reads the lamp bits and the timer value and pushes them to every connected page.

## Requirements

- A PC with **[Node.js](https://nodejs.org) 16 or newer** (check with `node -v`)
- A **Siemens S7 PLC** with the program below loaded, or a simulator that exposes the S7 protocol on port 102
- A phone or any browser on the **same network** as the PC
- TIA Portal, to load the program and change the PLC settings

## PLC program

![Ladder logic](docs/ladder.png)

The addresses are fixed in `server.js`, so your PLC program must use the same ones:

| Address | Tag | Direction | Meaning |
|---|---|---|---|
| `M1.3` | Start_pb_physical | page → PLC | Start. The server pulses it 1 for 300 ms. |
| `M1.7` | Stop_from_HMI | page → PLC | Stop. It is a **normally-closed** contact, so it rests at 0 and a pulse of 1 breaks the latch. |
| `M12.0` | Latch | PLC → page | Starter running (seal-in). |
| `M12.2` | star_k1 | PLC → page | Star contactor. On while the latch is on and the timer has not finished. |
| `M12.3` | Delta_k2 | PLC → page | Delta contactor. On after the timer finishes. |
| `MD14` | timer value | PLC → page | Elapsed time `ET` of the TON, data type `TIME` (milliseconds). |

Logic summary:

1. Start (`M1.3`) or the latch (`M12.0`), and not Stop (`M1.7`), keeps the latch on.
2. While the latch is on, a TON timer (`ondelay`, `DB7`, `PT = T#10s`) runs and its `ET` output goes to `MD14`.
3. Star (`M12.2`) is on while the latch is on and the timer output `Q` is off.
4. Delta (`M12.3`) turns on when the timer output `Q` turns on.

## Setup

### 1. Prepare the PLC

1. Create the program above in TIA Portal and download it. Put the PLC in **RUN**.
2. In the PLC properties, open **Protection & Security → Connection mechanisms** and tick **Permit access with PUT/GET communication from remote partner**. Download to the PLC again afterwards. Without this the PLC refuses the reads and writes.
3. Make sure the PC can reach the PLC, for example `ping 192.168.1.100`.

### 2. Get the project

```bash
git clone <your-repo-url>
cd <repo-folder>
npm install
```

`npm install` downloads the three libraries listed in `package.json` (`express`, `socket.io`, `nodes7`).

### 3. Set your PLC address

Open `server.js` and change the `initiateConnection` settings:

```js
plc.initiateConnection(
{
    host: "127.0.0.1",   // <-- put YOUR PLC's IP here
    port: 102,
    rack: 0,
    slot: 1              // S7-1200/1500 = 1, S7-300/400 = 2
},
```

`127.0.0.1` only works if the PLC simulator is running on the same PC and exposes port 102. For a real PLC use its IP address, for example `192.168.0.1`.

### 4. Run it

Start the PLC (or simulator) first, then:

```bash
node server.js
```

You should see:

```
Connecting to PLC...
PLC Connected
Server Running On Port 3000
```

### 5. Open it on the phone

1. Find your PC's IP address. On Windows run `ipconfig` and look for **IPv4 Address**. On Mac or Linux use `ifconfig` or `ip a`.
2. Connect the phone to the **same Wi-Fi** as the PC.
3. Open `http://<PC-IP>:3000` in the phone browser, for example `http://192.168.0.50:3000`.
4. The chip at the top right should say **Live**. Press **START** and watch the lamps and the timer.

On an iPhone you can tap **Share → Add to Home Screen** to open it like an app.

> Do not double-click `index.html` to open it. It only works when served by `server.js`, because it loads `/socket.io/socket.io.js` from the server.

## Troubleshooting

| Problem | What to check |
|---|---|
| Page shows **Offline** | The server is not running, or the phone is on a different network. Check the IP and port 3000. |
| Windows asks about the firewall | Click **Allow** for private networks. If you missed it, allow Node.js or port 3000 in Windows Firewall. |
| Terminal says `PLC Connection Failed` | Wrong IP, rack or slot, PLC not in RUN, or PUT/GET not enabled. The server tries to connect only once, so restart `node server.js` after fixing it. |
| Page says **Live** but nothing changes | The server is up but the PLC is not connected. Look at the terminal for errors. |
| START does nothing | The PLC must be in RUN. `M1.7` must rest at 0, otherwise the latch cannot start. |
| Timer stays at 0 | Check that the TON's `ET` output is wired to `MD14`. Add `console.log(data["MD14"])` in `server.js` to see the raw value. |
| Timer value looks wrong or negative | Change `"MD14"` to `"MDI14"` in `server.js` to read it as a signed 32-bit number. |
| Lamps do not match the PLC | Your PLC program must use `M12.0`, `M12.2` and `M12.3`. Change the addresses in `server.js` if yours differ. |

## Project structure

```
.
├── index.html      # phone HMI page (lamps, timer, START / STOP)
├── server.js       # Node.js server: web page + PLC read/write
├── package.json    # dependencies and start script
├── docs/
│   └── ladder.png  # PLC ladder logic
└── README.md
```

## Changing the project

- **Different addresses:** edit the `addItems([...])` list, the two `writeItems(...)` calls and the `update` object in `server.js`.
- **Different timer preset:** the bar in `index.html` assumes 10 seconds. If you change `PT` in the PLC, change `/10` to your preset in the `percent` line.
- **Looks:** all colours are CSS variables at the top of `index.html`.

## Safety

This is a **training demo**. The server has no password, so anyone on the network can open the page and press START or STOP. For a real machine, add authentication and a hard-wired emergency stop that does not depend on the phone, the network or this software.
