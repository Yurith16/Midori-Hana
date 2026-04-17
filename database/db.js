import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const file = path.join(__dirname, '..', 'database.json')

const defaultData = { groups: {}, users: {} }

const adapter = new JSONFile(file)
const db = new Low(adapter, defaultData)

export async function loadDatabase() {
  await db.read()
  if (!db.data) db.data = defaultData
  if (!db.data.groups) db.data.groups = {}
  if (!db.data.users) db.data.users = {}
  await db.write()
}

export function getGroupConfig(groupId) {
  if (!db.data.groups[groupId]) {
    db.data.groups[groupId] = {
      antiLink: false,
      adminMode: false,
      welcomeMessage: false,
      welcomeText: '',
      goodbyeText: '',
      nsfwEnabled: false,
      reactionEnabled: false,
      activity: {}
    }
    db.write()
  }
  
  if (!db.data.groups[groupId].activity) {
    db.data.groups[groupId].activity = {}
    db.write()
  }

  if (db.data.groups[groupId].nsfwEnabled === undefined) {
    db.data.groups[groupId].nsfwEnabled = false
    db.write()
  }

  if (db.data.groups[groupId].reactionEnabled === undefined) {
    db.data.groups[groupId].reactionEnabled = false
    db.write()
  }

  return db.data.groups[groupId]
}

export async function updateGroupConfig(groupId, updates) {
  const cfg = getGroupConfig(groupId)
  Object.assign(cfg, updates)
  await db.write()
  return cfg
}

export function trackActivity(groupId, userId) {
  const cfg = getGroupConfig(groupId)
  const prev = cfg.activity[userId]
  cfg.activity[userId] = {
    last: Date.now(),
    count: prev?.count ? prev.count + 1 : 1
  }
  db.write()
}

export function getUser(userId) {
  if (!db.data.users[userId]) {
    db.data.users[userId] = {
      name: '',
      age: null,
      registeredAt: Date.now(),
      exp: 0,
      level: 1,
      kryons: 100,
      jade: 0,
      dailyLast: 0,
      workLast: 0,
      robLast: 0
    }
    db.write()
  }
  return db.data.users[userId]
}

export async function registerUser(userId, name, age) {
  const user = getUser(userId)
  user.name = name
  user.age = age
  user.registeredAt = Date.now()
  await db.write()
  return user
}

export async function updateUser(userId, data) {
  const user = getUser(userId)
  Object.assign(user, data)
  await db.write()
  return user
}

export default db