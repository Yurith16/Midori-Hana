import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'
import { cleanNumber } from '../utils/jid.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const file = path.join(__dirname, '..', 'database.json')

const defaultData = { groups: {} }
const adapter = new JSONFile(file)
const db = new Low(adapter, defaultData)

export async function loadDatabase() {
  await db.read()
  if (!db.data) db.data = defaultData
  if (!db.data.groups) db.data.groups = {}
  await db.write()
  console.log('[DB] Base de datos cargada')
}

// ─── GRUPOS ───────────────────────────────────────────────

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

  // Blindaje: Asegurar que los objetos internos existan siempre
  if (!g.activity)   { g.activity = {};   db.write() }
  if (!g.warns)      { g.warns = {};      db.write() }
  if (!g.mutedUsers) { g.mutedUsers = {}; db.write() }

  if (g.groupName       === undefined) { g.groupName = '';       db.write() }
  if (g.nsfwEnabled     === undefined) { g.nsfwEnabled = false;  db.write() }
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

// ─── ACTIVIDAD ────────────────────────────────────────────

export function trackActivity(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id  = cleanNumber(userId)
  const prev = cfg.activity[id]
  cfg.activity[id] = {
    last:  Date.now(),
    count: prev?.count ? prev.count + 1 : 1
  }
  db.write()
}

// ─── WARNS ────────────────────────────────────────────────

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
  const cfg = getGroupConfig(groupId)
  return cfg.warns || {}
}

// ─── MUTE SYSTEM ──────────────────────────────────────────

export function setMute(groupId, userId, status = true) {
  const cfg = getGroupConfig(groupId)
  const id = cleanNumber(userId)

  // Inicialización de seguridad local
  if (!cfg.mutedUsers) cfg.mutedUsers = {}

  if (status) {
    cfg.mutedUsers[id] = true
  } else {
    delete cfg.mutedUsers[id]
  }
  db.write()
}

export function isUserMuted(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const id = cleanNumber(userId)

  // Retorna true solo si el usuario existe en el objeto y su valor es true
  return cfg.mutedUsers && cfg.mutedUsers[id] === true
}

export default db