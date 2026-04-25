import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { cleanNumber } from '../utils/jid.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const subbotDbs = new Map()

async function getDb(numero) {
  if (subbotDbs.has(numero)) return subbotDbs.get(numero)
  const dir = path.join(__dirname, '..', 'db-subbot')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const dbFile   = path.join(dir, `${numero}.json`)
  const adapter  = new JSONFile(dbFile)
  const db       = new Low(adapter, { groups: {}, settings: {} })
  await db.read()
  if (!db.data)          db.data = { groups: {}, settings: {} }
  if (!db.data.groups)   db.data.groups = {}
  if (!db.data.settings) db.data.settings = {}
  await db.write()
  subbotDbs.set(numero, db)
  return db
}

// ─── GRUPOS ───────────────────────────────────────────────

export async function getSubbotGroupConfig(numero, groupId) {
  const db = await getDb(numero)
  if (!db.data.groups[groupId]) {
    db.data.groups[groupId] = {
      groupName:       '',
      antiLink:        false,
      adminMode:       false,
      welcomeMessage:  false,
      welcomeText:     '',
      goodbyeText:     '',
      nsfwEnabled:     false,
      reactionEnabled: false,
      activity:        {},
      warns:           {},
      mutedUsers:      {}
    }
    await db.write()
  }
  const g = db.data.groups[groupId]
  if (!g.activity)   { g.activity = {};   await db.write() }
  if (!g.warns)      { g.warns = {};      await db.write() }
  if (!g.mutedUsers) { g.mutedUsers = {}; await db.write() }
  return g
}

export async function updateSubbotGroupConfig(numero, groupId, updates) {
  const db  = await getDb(numero)
  const cfg = await getSubbotGroupConfig(numero, groupId)
  Object.assign(cfg, updates)
  await db.write()
  return cfg
}

export async function trackSubbotActivity(numero, groupId, userId) {
  const db  = await getDb(numero)
  const cfg = await getSubbotGroupConfig(numero, groupId)
  const id  = cleanNumber(userId)
  const prev = cfg.activity[id]
  cfg.activity[id] = {
    last:  Date.now(),
    count: prev?.count ? prev.count + 1 : 1
  }
  await db.write()
}

export async function updateSubbotGroupName(numero, groupId, name) {
  const db  = await getDb(numero)
  const cfg = await getSubbotGroupConfig(numero, groupId)
  if (cfg.groupName !== name) {
    cfg.groupName = name
    await db.write()
  }
}

export async function isSubbotUserMuted(numero, groupId, userId) {
  const cfg = await getSubbotGroupConfig(numero, groupId)
  const id  = cleanNumber(userId)
  return cfg.mutedUsers?.[id] === true
}

// ─── MUTE EN SUBBOT ─────────────────────────────────────

export async function setSubbotMute(numero, groupId, userId, status = true) {
  const cfg = await getSubbotGroupConfig(numero, groupId)
  const id  = cleanNumber(userId)
  
  if (status) {
    cfg.mutedUsers[id] = true
  } else {
    delete cfg.mutedUsers[id]
  }
  
  await updateSubbotGroupConfig(numero, groupId, { mutedUsers: cfg.mutedUsers })
}

// ─── SETTINGS DEL SUBBOT ─────────────────────────────────

const defaultSettings = {
  ownerNumber:  '',
  prefix:       '*',
  autoRead:     false,
  autoBio:      true,
  antiCall:     true,
  antiSpam:     true,
  allowPrivate: true,
  menuImage:    null 
}

export async function getSubbotSettings(numero) {
  const db = await getDb(numero)
  if (!db.data.settings || !db.data.settings.ownerNumber) {
    db.data.settings = { ...defaultSettings, ownerNumber: numero }
    await db.write()
  }
  let changed = false
  for (const [key, val] of Object.entries(defaultSettings)) {
    if (db.data.settings[key] === undefined) {
      db.data.settings[key] = val
      changed = true
    }
  }
  if (changed) await db.write()
  return db.data.settings
}

export async function updateSubbotSettings(numero, updates) {
  const db = await getDb(numero)
  await getSubbotSettings(numero)
  Object.assign(db.data.settings, updates)
  await db.write()
  return db.data.settings
}

export async function getSubbotDb(numero) {
  return getDb(numero)
}