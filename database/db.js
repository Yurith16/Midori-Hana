import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { cleanNumber } from '../utils/jid.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const file       = path.join(__dirname, '..', 'database.json')

const defaultData = { groups: {} }
const adapter     = new JSONFile(file)
const db          = new Low(adapter, defaultData)

export async function loadDatabase() {
  await db.read()
  if (!db.data)         db.data = defaultData
  if (!db.data.groups)  db.data.groups = {}
  await db.write()
  console.log('[DB] Base de datos cargada')
}

export function getGroupConfig(groupId) {
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
    db.write()
  }
  const g = db.data.groups[groupId]
  if (!g.activity)                     { g.activity = {};           db.write() }
  if (!g.warns)                        { g.warns = {};              db.write() }
  if (!g.mutedUsers)                   { g.mutedUsers = {};         db.write() }
  if (g.groupName       === undefined) { g.groupName = '';          db.write() }
  if (g.nsfwEnabled     === undefined) { g.nsfwEnabled = false;     db.write() }
  if (g.reactionEnabled === undefined) { g.reactionEnabled = false; db.write() }
  return g
}

export async function updateGroupConfig(groupId, updates) {
  const cfg = getGroupConfig(groupId)
  Object.assign(cfg, updates)
  await db.write()
  return cfg
}

export function updateGroupName(groupId, name) {
  const cfg = getGroupConfig(groupId)
  if (cfg.groupName !== name) {
    cfg.groupName = name
    db.write()
  }
}

export function trackActivity(groupId, userId) {
  const cfg  = getGroupConfig(groupId)
  const id   = cleanNumber(userId)
  const prev = cfg.activity[id]
  cfg.activity[id] = {
    last:  Date.now(),
    count: prev?.count ? prev.count + 1 : 1
  }
  db.write()
}

export function getWarnEntry(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  return cfg.warns[id] || { count: 0, name: '' }
}

export function addWarn(groupId, userId, name = '') {
  const cfg  = getGroupConfig(groupId)
  const id   = cleanNumber(userId)
  const prev = cfg.warns[id] || { count: 0, name: '' }
  cfg.warns[id] = {
    count: prev.count + 1,
    name:  name || prev.name || id
  }
  db.write()
  return cfg.warns[id].count
}

export function delWarn(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  if (cfg.warns[id]) {
    cfg.warns[id].count = Math.max(0, cfg.warns[id].count - 1)
    if (cfg.warns[id].count === 0) delete cfg.warns[id]
    db.write()
  }
}

export function resetWarns(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  delete cfg.warns[id]
  db.write()
}

export function getAllWarns(groupId) {
  return getGroupConfig(groupId).warns || {}
}

export function setMute(groupId, userId, status = true) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  if (status) {
    cfg.mutedUsers[id] = true
  } else {
    delete cfg.mutedUsers[id]
  }
  db.write()
}

export function isUserMuted(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  return cfg.mutedUsers?.[id] === true
}

// ─── DB POR SUBBOT ────────────────────────────────────────

const subbotDbs = new Map()

export async function getSubbotDb(numero) {
  if (subbotDbs.has(numero)) return subbotDbs.get(numero)

  const dir = path.join(__dirname, '..', 'db-subbot')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const dbFile   = path.join(dir, `${numero}.json`)
  const adapter  = new JSONFile(dbFile)
  const subbotDb = new Low(adapter, { groups: {}, settings: {} })
  await subbotDb.read()
  if (!subbotDb.data)          subbotDb.data = { groups: {}, settings: {} }
  if (!subbotDb.data.groups)   subbotDb.data.groups = {}
  if (!subbotDb.data.settings) subbotDb.data.settings = {}
  await subbotDb.write()

  subbotDbs.set(numero, subbotDb)
  return subbotDb
}

export async function getSubbotSettings(numero) {
  const subbotDb = await getSubbotDb(numero)
  return subbotDb.data.settings
}

export async function updateSubbotSettings(numero, updates) {
  const subbotDb = await getSubbotDb(numero)
  Object.assign(subbotDb.data.settings, updates)
  await subbotDb.write()
  return subbotDb.data.settings
}

export default db