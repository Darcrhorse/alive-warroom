# ALiVE War Room - Tactical Feed

Real-time tactical dashboard for Arma 3 ALiVE missions with per-player fog of war.

## Features

- **Squad Mode**: Each player only sees what their squad has detected
- **Fog of War**: No godmode - enemies only appear when spotted
- **Multi-player**: Each player gets their own personalized view
- **Real-time**: Updates every 2 seconds via WebSocket

## Requirements

### Host Only
- TacControl mod (@TacControl from Steam Workshop)
- Node.js server running (`alive-server-v3.js`)

### All Players
- The mission with bridge scripts installed
- A web browser

## Quick Start

1. **Host starts server:**
   ```
   node alive-server-v3.js
   ```

2. **Host launches Arma 3** with TacControl mod

3. **All players open dashboard:**
   - Player view: `http://HOST_IP:1338/player.html?player=YourName`
   - Admin view: `http://HOST_IP:1338/admin.html?admin=true`

## How It Works

```
[Brother's PC]                    [Your PC - Host]
     |                                  |
 Arma 3 Client                    Arma 3 Server
     |                                  |
 Collects own                    TacControl Mod
 detection data                        |
     |                           WebSocket :8082
     +--- publicVariableServer -------> |
                                        |
                                  Node.js Server
                                   :1338
                                        |
     <-------- WebSocket --------------- +
     |                                  |
 player.html                      player.html
 (Brother's view)                 (Your view)
```

## Dashboards

| Dashboard | URL | Description |
|-----------|-----|-------------|
| Player | `/player.html?player=Name` | Fog of war, squad intel only |
| Admin | `/admin.html?admin=true` | Full overview, all units |

## Mission Setup

Add to your mission's `init.sqf`:
```sqf
[] execVM "scripts\alive_dashboard_bridge.sqf";  // Admin data
[] execVM "scripts\alive_player_bridge.sqf";     // Per-player data
```

## License

MIT - Use freely for your Arma 3 missions!
