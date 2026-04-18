# Midori-Hana WhatsApp Bot

## Overview
A modular WhatsApp bot built with Node.js and the Baileys library. Features group administration, media downloading, entertainment (anime, games), economy system, and AI integration.

## Tech Stack
- **Runtime:** Node.js 20 (ES Modules)
- **WhatsApp Library:** @whiskeysockets/baileys
- **Database:** lowdb (JSON-based local storage → database.json)
- **Media:** ffmpeg-static, sharp, wa-sticker-formatter
- **Logging:** pino, chalk

## Project Structure
- `index.js` — Entry point; handles WhatsApp connection, auth (QR or pairing code), session management
- `handler.js` — Central message processor; command routing, plugin loading, permissions
- `config.js` — Bot configuration (name, owner numbers, prefix, feature toggles)
- `plugins/` — Modular command plugins (admin, downloads, economy, entertainment, NSFW, tools)
- `utils/` — Helper utilities (JID handling, logging, media conversion, file watching)
- `database/` — Database logic via lowdb

## Configuration
Edit `config.js` to set:
- `ownerNumbers` — Bot owner phone numbers
- `botNumber` — Bot's WhatsApp number
- `useQR` — true for QR code auth, false for pairing code
- `sessionName` — Session folder name (default: `kari-session`)
- `prefix` — Command prefix (default: `*`)

## Running
- Workflow: "Start application" → `node index.js`
- On first run: authenticate via QR code (shown in console) or pairing code

## Authentication
- Session stored in `kari-session/` folder (gitignored)
- If `useQR: true` in config.js → shows QR in console
- If `useQR: false` → requests pairing code for configured phone number
