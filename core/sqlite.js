import Database from 'better-sqlite3'
import { logger } from '../utils/helpers.js'

const db = new Database('./midori.db')
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    group_id    TEXT PRIMARY KEY,
    name        TEXT DEFAULT '',
    antiLink    INTEGER DEFAULT 0,
    adminMode   INTEGER DEFAULT 0,
    nsfw        INTEGER DEFAULT 0,
    updated_at  INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS warns (
    group_id TEXT,
    user     TEXT,
    count    INTEGER DEFAULT 0,
    PRIMARY KEY (group_id, user)
  );

  CREATE TABLE IF NOT EXISTS mutes (
    group_id TEXT,
    user     TEXT,
    muted_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (group_id, user)
  );

  CREATE TABLE IF NOT EXISTS ignored (
    group_id TEXT,
    user     TEXT,
    PRIMARY KEY (group_id, user)
  );

  CREATE TABLE IF NOT EXISTS activity (
    group_id  TEXT,
    user      TEXT,
    msgs      INTEGER DEFAULT 0,
    last_seen INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (group_id, user)
  );

  CREATE TABLE IF NOT EXISTS msg_history (
    group_id TEXT,
    msg_id   TEXT,
    sender   TEXT,
    sent_at  INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (group_id, msg_id)
  );

  CREATE TABLE IF NOT EXISTS banned (
    user      TEXT PRIMARY KEY,
    banned_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS users (
    user_num         TEXT PRIMARY KEY,
    nombre           TEXT DEFAULT '',
    apodo            TEXT DEFAULT '',
    edad             INTEGER DEFAULT 0,
    genero           TEXT DEFAULT '',
    frase            TEXT DEFAULT '',
    color            TEXT DEFAULT '',
    animal           TEXT DEFAULT '',
    foto             TEXT DEFAULT '',
    titulo           TEXT DEFAULT '',
    cumple           TEXT DEFAULT '',
    ultima_actividad INTEGER DEFAULT 0,
    registered_at    INTEGER DEFAULT (unixepoch())
  );
`)

// ─── Migraciones seguras ──────────────────────────────────────────────────────

try { db.exec(`ALTER TABLE groups ADD COLUMN prefix TEXT DEFAULT ''`) }        catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN antiToxic INTEGER DEFAULT 1`) }   catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN detect INTEGER DEFAULT 0`) }      catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN saludos INTEGER DEFAULT 0`) }     catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN ultimo_saludo_manana INTEGER DEFAULT 0`) } catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN ultimo_saludo_tarde INTEGER DEFAULT 0`) }  catch {}
try { db.exec(`ALTER TABLE groups ADD COLUMN ultimo_saludo_noche INTEGER DEFAULT 0`) }  catch {}

logger.info('SQLite', 'Base de datos lista ✦')

// ─── Groups ───────────────────────────────────────────────────────────────────

const _getGroup    = db.prepare(`SELECT * FROM groups WHERE group_id = ?`)
const _insertGroup = db.prepare(`INSERT OR IGNORE INTO groups (group_id) VALUES (?)`)
const _patchGroup  = (col) => db.prepare(`UPDATE groups SET ${col} = ?, updated_at = unixepoch() WHERE group_id = ?`)

export function getGroup(groupId) {
  _insertGroup.run(groupId)
  return _getGroup.get(groupId)
}
export function setGroupField(groupId, field, value) {
  _insertGroup.run(groupId)
  _patchGroup(field).run(value, groupId)
}
export function updateGroupName(groupId, name) {
  setGroupField(groupId, 'name', name)
}

const _getGroupsWithSaludos  = db.prepare(`SELECT * FROM groups WHERE saludos = 1`)
const _setSaludoTs           = (col) => db.prepare(`UPDATE groups SET ${col} = ? WHERE group_id = ?`)

export function getGroupsWithSaludos() {
  return _getGroupsWithSaludos.all()
}
export function setSaludoTimestamp(groupId, tipo) {
  const col = `ultimo_saludo_${tipo}`
  _setSaludoTs(col).run(Math.floor(Date.now() / 1000), groupId)
}

// ─── Warns ────────────────────────────────────────────────────────────────────

const _getWarns   = db.prepare(`SELECT count FROM warns WHERE group_id = ? AND user = ?`)
const _addWarn    = db.prepare(`INSERT INTO warns (group_id, user, count) VALUES (?,?,1) ON CONFLICT(group_id,user) DO UPDATE SET count = count + 1`)
const _resetWarns = db.prepare(`DELETE FROM warns WHERE group_id = ? AND user = ?`)

export function getWarns(groupId, user)   { return _getWarns.get(groupId, user)?.count || 0 }
export function addWarn(groupId, user)    { _addWarn.run(groupId, user); return getWarns(groupId, user) }
export function resetWarns(groupId, user) { _resetWarns.run(groupId, user) }

// ─── Mutes ────────────────────────────────────────────────────────────────────

const _mute    = db.prepare(`INSERT OR IGNORE INTO mutes (group_id, user) VALUES (?,?)`)
const _unmute  = db.prepare(`DELETE FROM mutes WHERE group_id = ? AND user = ?`)
const _isMuted = db.prepare(`SELECT 1 FROM mutes WHERE group_id = ? AND user = ?`)

export function muteUser(groupId, user)   { _mute.run(groupId, user) }
export function unmuteUser(groupId, user) { _unmute.run(groupId, user) }
export function isMuted(groupId, user)    { return !!_isMuted.get(groupId, user) }

// ─── Activity ─────────────────────────────────────────────────────────────────

const _trackActivity  = db.prepare(`
  INSERT INTO activity (group_id, user, msgs, last_seen) VALUES (?,?,1,unixepoch())
  ON CONFLICT(group_id,user) DO UPDATE SET msgs = msgs + 1, last_seen = unixepoch()
`)
const _getTopActivity = db.prepare(`SELECT user, msgs FROM activity WHERE group_id = ? ORDER BY msgs DESC LIMIT ?`)

export function trackActivity(groupId, user)        { _trackActivity.run(groupId, user) }
export function getTopActivity(groupId, limit = 10) { return _getTopActivity.all(groupId, limit) }

// ─── Historial de mensajes ────────────────────────────────────────────────────

const _saveMsg      = db.prepare(`INSERT OR IGNORE INTO msg_history (group_id, msg_id, sender, sent_at) VALUES (?,?,?,?)`)
const _cleanOld     = db.prepare(`DELETE FROM msg_history WHERE group_id = ? AND msg_id NOT IN (SELECT msg_id FROM msg_history WHERE group_id = ? ORDER BY sent_at DESC LIMIT 500)`)
const _getMsgsSince = db.prepare(`SELECT msg_id, sender FROM msg_history WHERE group_id = ? AND sent_at >= ? ORDER BY sent_at DESC`)
const _getLastMsgs  = db.prepare(`SELECT msg_id, sender FROM msg_history WHERE group_id = ? ORDER BY sent_at DESC LIMIT ?`)
const _deleteMsg    = db.prepare(`DELETE FROM msg_history WHERE group_id = ? AND msg_id = ?`)

export function saveMsg(groupId, msgId, sender) {
  _saveMsg.run(groupId, msgId, sender, Math.floor(Date.now() / 1000))
  _cleanOld.run(groupId, groupId)
}
export function getMsgsSince(groupId, seconds) {
  return _getMsgsSince.all(groupId, Math.floor(Date.now() / 1000) - seconds)
}
export function getLastMsgs(groupId, limit)          { return _getLastMsgs.all(groupId, limit) }
export function deleteMsgFromHistory(groupId, msgId) { _deleteMsg.run(groupId, msgId) }

// ─── Ban global ───────────────────────────────────────────────────────────────

const _ban       = db.prepare(`INSERT OR IGNORE INTO banned (user) VALUES (?)`)
const _unban     = db.prepare(`DELETE FROM banned WHERE user = ?`)
const _isBanned  = db.prepare(`SELECT 1 FROM banned WHERE user = ?`)
const _getBanned = db.prepare(`SELECT user FROM banned ORDER BY banned_at DESC`)

export function banUser(user)   { _ban.run(user) }
export function unbanUser(user) { _unban.run(user) }
export function isBanned(user)  { return !!_isBanned.get(user) }
export function getBanned()     { return _getBanned.all().map(r => r.user) }

// ─── Users ────────────────────────────────────────────────────────────────────

const _getUser      = db.prepare(`SELECT * FROM users WHERE user_num = ?`)
const _createUser   = db.prepare(`INSERT OR IGNORE INTO users (user_num, nombre, apodo, edad, genero) VALUES (?,?,?,?,?)`)
const _updateUser   = db.prepare(`UPDATE users SET nombre=?, apodo=?, edad=?, genero=? WHERE user_num=?`)
const _isRegistered = db.prepare(`SELECT 1 FROM users WHERE user_num = ? AND nombre != ''`)
const _countUsers   = db.prepare(`SELECT COUNT(*) as n FROM users`)

export function getUser(userNum)      { return _getUser.get(userNum) }
export function isRegistered(userNum) { return !!_isRegistered.get(userNum) }
export function countUsers()          { return _countUsers.get()?.n || 0 }

export function registerUser(userNum, { nombre, apodo, edad, genero }) {
  _createUser.run(userNum, nombre, apodo || '', edad || 0, genero || '')
}
export function updateUser(userNum, { nombre, apodo, edad, genero }) {
  _updateUser.run(nombre, apodo || '', edad, genero || '', userNum)
}

// ─── Auto-registro (solo lo disparan los comandos de perfil) ──────────────────

export function ensureRegistered(userNum, pushName) {
  if (isRegistered(userNum)) return
  const nombre = (pushName || '').trim().slice(0, 30) || `Alma Errante-${countUsers() + 1}`
  registerUser(userNum, { nombre, apodo: '', edad: 0, genero: '' })
}

// ─── Perfil extendido ─────────────────────────────────────────────────────────

const _setUserField = (field) => db.prepare(`UPDATE users SET ${field} = ? WHERE user_num = ?`)

export function setUserField(userNum, field, value) {
  _setUserField(field).run(value, userNum)
}
export function getAge(userNum) {
  return _getUser.get(userNum)?.edad || 0
}

// ─── Actividad y cumpleaños del perfil ────────────────────────────────────────

const _setUltimaActividad = db.prepare(`UPDATE users SET ultima_actividad = ? WHERE user_num = ?`)

export function marcarActividad(userNum) {
  _setUltimaActividad.run(Math.floor(Date.now() / 1000), userNum)
}

// ─── Reset global de perfiles ─────────────────────────────────────────────────

const _resetAllProfiles = db.prepare(`DELETE FROM users`)

export function resetTodosLosPerfiles() {
  _resetAllProfiles.run()
}

// ─── Ignored ─────────────────────────────────────────────────────────────────

const _ignoreUser   = db.prepare(`INSERT OR IGNORE INTO ignored (group_id, user) VALUES (?,?)`)
const _unignoreUser = db.prepare(`DELETE FROM ignored WHERE group_id = ? AND user = ?`)
const _isIgnored    = db.prepare(`SELECT 1 FROM ignored WHERE group_id = ? AND user = ?`)
const _getIgnored   = db.prepare(`SELECT user FROM ignored WHERE group_id = ?`)

export function ignoreUser(groupId, user)   { _ignoreUser.run(groupId, user) }
export function unignoreUser(groupId, user) { _unignoreUser.run(groupId, user) }
export function isIgnored(groupId, user)    { return !!_isIgnored.get(groupId, user) }
export function getIgnored(groupId)         { return _getIgnored.all(groupId).map(r => r.user) }

export default db