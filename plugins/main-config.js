import { setGroupField, getGroup } from '../core/sqlite.js'
import { writeFileSync }           from 'fs'
import { resolve }                 from 'path'
import { toBold }                  from '../utils/helpers.js'

// ─── Definición de features ───────────────────────────────────────────────────

const OWNER_FEATURES = {
  anticall:      { key: 'antiCall',     label: 'Anti llamadas' },
  autoread:      { key: 'autoRead',     label: 'Leer mensajes automático' },
  autobio:       { key: 'autoBio',      label: 'Bio automática' },
  antispam:      { key: 'antiSpam',     label: 'Anti spam' },
  antiprivado:   { key: 'allowPrivate', label: 'Bloquear uso en privado', invertido: true },
  mantenimiento: { key: 'maintenance',  label: 'Modo mantenimiento' },
}

const GROUP_FEATURES = {
  antilink:  { key: 'antiLink',   label: 'Anti enlaces' },
  antitoxic: { key: 'antiToxic',  label: 'Anti insultos' },
  modoadmin: { key: 'adminMode',  label: 'Solo admins' },
  detect:    { key: 'detect',     label: 'Detectar cambios del grupo' },
  saludos:   { key: 'saludos',    label: 'Saludos automáticos por horario' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saveFeatures() {
  const f    = global.features
  const body = `const features = ${JSON.stringify(f, null, 2)}\n\nglobal.features = features\nexport default features\n`
  writeFileSync(resolve('settings/features.js'), body, 'utf8')
}

function on(val) {
  return val ? '🟢 *on*' : '⚪ *off*'
}

// ─── Respuestas rotativas — función inválida ─────────────────────────────────

const RESPUESTAS_INVALIDAS = [
  (feature, cmd) => `*${feature}* no existe en mi lista, ¿lo inventaste o solo se te fue el dedo? Escribe .${cmd} sin argumentos para ver la lista.`,
  (feature, cmd) => `Esa función no la conozco. Escribe .${cmd} sola y te muestro las que sí existen.`,
  (feature, cmd) => `*${feature}*... no, esa no está en mi menú. Revisa bien y vuelve a intentar.`,
  (feature, cmd) => `No tengo ninguna función llamada así. .${cmd} sin nada te enseña las que sí puedo tocar.`,
  (feature, cmd) => `¿*${feature}*? No, esa me la acabas de inventar. Mira la lista con .${cmd} a secas.`,
]

let colaInvalidas = []

function siguienteInvalida(feature, cmd) {
  if (colaInvalidas.length === 0) {
    colaInvalidas = RESPUESTAS_INVALIDAS.map((_, i) => i)
    for (let i = colaInvalidas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[colaInvalidas[i], colaInvalidas[j]] = [colaInvalidas[j], colaInvalidas[i]]
    }
  }
  const idx = colaInvalidas.pop()
  return RESPUESTAS_INVALIDAS[idx](feature, cmd)
}

function renderEstado(f, cfg, isOwner, isGroup, ownerLabel, groupLabel) {
  let txt = ''

  if (isOwner) {
    txt += `> │ ${toBold(ownerLabel)}\n`
    txt += `> │ ✦ anticall      ${on(f.antiCall)}\n`
    txt += `> │ ✦ autoread      ${on(f.autoRead)}\n`
    txt += `> │ ✦ autobio       ${on(f.autoBio)}\n`
    txt += `> │ ✦ antispam      ${on(f.antiSpam)}\n`
    txt += `> │ ✦ antiprivado   ${on(!f.allowPrivate)}\n`
    txt += `> │ ✦ mantenimiento ${on(f.maintenance)}\n`
    txt += `> │\n`
  }

  if (isGroup && cfg) {
    txt += `> │ ${toBold(groupLabel)}\n`
    txt += `> │ ✦ antilink   ${on(cfg.antiLink === 1)}\n`
    txt += `> │ ✦ antitoxic  ${on(cfg.antiToxic !== 0)}\n`
    txt += `> │ ✦ modoadmin  ${on(cfg.adminMode === 1)}\n`
    txt += `> │ ✦ detect     ${on(cfg.detect === 1)}\n`
    txt += `> │ ✦ saludos    ${on(cfg.saludos === 1)}\n`
    txt += `> │\n`
  }

  return txt
}

// ─── Lógica compartida enable/disable ────────────────────────────────────────

async function toggleFeature(activar, sock, msg, { from, args, isOwner, isAdmin, isGroup }) {
  const feature = args[0]?.toLowerCase()

  if (!feature) {
    const f   = global.features || {}
    const cfg = isGroup ? getGroup(from) : null

    let txt = `> ╭─〔 🌸 *${activar ? 'ENABLE' : 'DISABLE'}* 〕\n`
    txt += `> │\n`
    txt += renderEstado(f, cfg, isOwner, isGroup, 'Globales — owner', 'Este grupo — admin o owner')
    txt += `> │ _Uso: .${activar ? 'enable' : 'disable'} opcion_\n`
    txt += `> ╰─── ${toBold(global.bot?.name || 'Bot')} ✦`

    await sock.sendMessage(from, { text: txt }, { quoted: msg })
    return
  }

  // ── Feature de owner (global) ─────────────────────────────────────────────
  if (OWNER_FEATURES[feature]) {
    if (!isOwner) {
      await sock.sendMessage(from, { text: global.messages?.ownerOnly }, { quoted: msg })
      return
    }

    const def   = OWNER_FEATURES[feature]
    const valor = def.invertido ? !activar : activar

    global.features[def.key] = valor
    saveFeatures()

    await sock.sendMessage(from, { react: { text: activar ? '✅' : '🔴', key: msg.key } })
    await sock.sendMessage(from, {
      text: `${activar ? '✅' : '🔴'} *${def.label}* ${activar ? 'activado' : 'desactivado'} globalmente.`
    }, { quoted: msg })
    return
  }

  // ── Feature de grupo ──────────────────────────────────────────────────────
  if (GROUP_FEATURES[feature]) {
    if (!isGroup) {
      await sock.sendMessage(from, { text: global.messages?.groupOnly }, { quoted: msg })
      return
    }
    if (!isOwner && !isAdmin) {
      await sock.sendMessage(from, { text: global.messages?.notAdmin }, { quoted: msg })
      return
    }

    const def   = GROUP_FEATURES[feature]
    const valor = activar ? 1 : 0

    setGroupField(from, def.key, valor)
    if (def.extra) setGroupField(from, def.extra, valor)

    await sock.sendMessage(from, { react: { text: activar ? '✅' : '🔴', key: msg.key } })
    await sock.sendMessage(from, {
      text: `${activar ? '✅' : '🔴'} *${def.label}* ${activar ? 'activado' : 'desactivado'} en este grupo.`
    }, { quoted: msg })
    return
  }

  await sock.sendMessage(from, {
    text: siguienteInvalida(feature, activar ? 'enable' : 'disable')
  }, { quoted: msg })
}

// ─── Comandos ─────────────────────────────────────────────────────────────────

const enable = {
  command:     'enable',
  tag:         'enable',
  categoria:   'admin',
  owner:       false,
  group:       false,
  nsfw:        false,
  descripcion: 'Activa una función del grupo',

  async execute(sock, msg, ctx) {
    await toggleFeature(true, sock, msg, ctx)
  }
}

const disable = {
  command:     'disable',
  tag:         'disable',
  categoria:   'admin',
  owner:       false,
  group:       false,
  nsfw:        false,
  descripcion: 'Desactiva una función del grupo',

  async execute(sock, msg, ctx) {
    await toggleFeature(false, sock, msg, ctx)
  }
}

const config = {
  command:     'config',
  tag:         'config',
  categoria:   'admin',
  owner:       false,
  group:       false,
  nsfw:        false,
  descripcion: 'Muestra la configuración actual del grupo',

  async execute(sock, msg, { from, isOwner, isAdmin, isGroup }) {
    if (!isOwner && !isAdmin) {
      await sock.sendMessage(from, { text: global.messages?.notAdmin }, { quoted: msg })
      return
    }

    const f   = global.features || {}
    const cfg = isGroup ? getGroup(from) : null

    let txt = `> ╭─〔 🌸 *CONFIGURACIÓN* 〕\n`
    txt += `> │\n`
    txt += renderEstado(f, cfg, isOwner, isGroup, 'Globales', 'Este grupo')
    txt += `> ╰─── ${toBold(global.bot?.name || 'Bot')} ✦`

    await sock.sendMessage(from, { text: txt }, { quoted: msg })
  }
}

export default [enable, disable, config]