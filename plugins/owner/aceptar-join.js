import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  command: ['aceptar', 'accept', 'aprobar'],
  group: false,
  owner: true,

  async execute(sock, msg, { from, args }) {
    try {
      const groupUrl = args[0]

      if (!groupUrl) {
        await sock.sendMessage(from, {
          text: '> ❌ *Uso correcto:*\n> .aceptar https://chat.whatsapp.com/xxxxx'
        }, { quoted: msg })
        return
      }

      // Limpiar la URL (eliminar espacios, saltos de línea, etc.)
      let cleanUrl = groupUrl.trim()
      cleanUrl = cleanUrl.split('\n')[0].split(' ')[0]

      if (!cleanUrl.includes('chat.whatsapp.com')) {
        await sock.sendMessage(from, {
          text: '> ❌ *URL inválida*\n> Solo se permiten enlaces de invitación de WhatsApp\n> *Ejemplo:* https://chat.whatsapp.com/AbCdEfG12345'
        }, { quoted: msg })
        return
      }

      // Extraer código de invitación correctamente
      let inviteCode = cleanUrl.split('chat.whatsapp.com/')[1]

      // Limpiar el código (eliminar parámetros adicionales, espacios, etc.)
      inviteCode = inviteCode.split('?')[0].split('#')[0].trim()

      // Validar que el código tenga la longitud correcta (normalmente 22 caracteres)
      if (!inviteCode || inviteCode.length < 20) {
        await sock.sendMessage(from, {
          text: `> ❌ *Código de invitación inválido*\n> 📝 *Código detectado:* ${inviteCode || 'ninguno'}\n> 🔗 *URL recibida:* ${cleanUrl}\n\n> *Posibles causas:*\n> • URL incompleta\n> • Enlace expirado\n> • Código mal formado`
        }, { quoted: msg })
        return
      }

      // Verificar si el bot ya está en el grupo
      const allGroups = await sock.groupFetchAllParticipating()
      const groupIds = Object.keys(allGroups)

      let alreadyInGroup = false
      let groupName = ''

      for (const groupId of groupIds) {
        try {
          const groupMetadata = await sock.groupMetadata(groupId)
          if (groupMetadata.inviteCode === inviteCode) {
            alreadyInGroup = true
            groupName = groupMetadata.subject
            break
          }
        } catch (err) {
          continue
        }
      }

      if (alreadyInGroup) {
        await sock.sendMessage(from, {
          text: `> ⚠️ *El bot ya se encuentra en este grupo*\n\n📋 *Grupo:* ${groupName}\n🔗 *Código:* ${inviteCode}\n\n> No es necesario volver a unirse`
        }, { quoted: msg })
        return
      }

      // Intentar unirse al grupo
      await sock.sendMessage(from, {
        text: `> 🔄 *Intentando unirme al grupo...*\n> 🔗 *Código:* ${inviteCode}\n> ⏳ Procesando...`
      }, { quoted: msg })

      try {
        // Intentar unirse
        const result = await sock.groupAcceptInvite(inviteCode)

        await sock.sendMessage(from, {
          text: `> ✅ *¡El bot se unió al grupo exitosamente!*\n> 🔗 *Código:* ${inviteCode}\n> 🎉 El bot ya está listo para usar`
        }, { quoted: msg })

      } catch (joinError) {
        console.error('Error al unirse:', joinError)

        let errorMsg = '> ❌ *No se pudo unir al grupo*\n\n'

        // Manejo específico del error bad-request
        if (joinError.message.includes('bad-request') || joinError.data === 400) {
          errorMsg += '> 🔴 *Causa:* Enlace inválido o mal formado\n\n'
          errorMsg += '> *Posibles soluciones:*\n'
          errorMsg += '> 1. Verifica que la URL esté completa\n'
          errorMsg += '> 2. El enlace puede haber expirado\n'
          errorMsg += '> 3. Genera un nuevo enlace de invitación\n\n'
          errorMsg += `> 📝 *Tu enlace:* ${cleanUrl}\n`
          errorMsg += `> 🔑 *Código extraído:* ${inviteCode}\n`
          errorMsg += `> ℹ️ *Longitud del código:* ${inviteCode.length} caracteres (deberían ser ~22)`
        } else if (joinError.message.includes('401')) {
          errorMsg += '> 🔒 Enlace expirado, solicita uno nuevo'
        } else if (joinError.message.includes('409')) {
          errorMsg += '> 👥 El bot ya está en el grupo'
        } else if (joinError.message.includes('404')) {
          errorMsg += '> ❓ Grupo no encontrado o enlace inválido'
        } else {
          errorMsg += `> ⚠️ *Error:* ${joinError.message}`
        }

        await sock.sendMessage(from, {
          text: errorMsg
        }, { quoted: msg })
      }

    } catch (err) {
      console.error('Error en aceptar:', err)
      await sock.sendMessage(from, {
        text: `> ❌ *Error general:* ${err.message}\n> Intenta nuevamente con un enlace válido`
      }, { quoted: msg })
    }
  }
}