const messages = {
  // ─── Sistema ────────────────────────────────────────────────────────────────
  online:       'Ya estoy aquí, por si alguien me necesitaba. No es que me hayan extrañado, pero aquí estoy de todas formas.',
  offline:      'Me voy un momento, no prometo que sea poco tiempo. Cuídense mientras tanto.',
  reconnecting: 'Espera, me estoy reconectando. Estas cosas pasan y no está en mis manos evitarlo.',
  maintenance:  'Estoy en mantenimiento para ofrecerte lo mejor de mí.',
  error:        'No me preguntes qué pasó porque yo tampoco lo entiendo del todo, pero algo salió mal. Intenta de nuevo y a ver si esta vez funciona.',

  // ─── Accesos ────────────────────────────────────────────────────────────────
  ownerOnly:    'Eso solo puede hacerlo Hernandez, y a menos que seas él, mejor busca otro camino.',
  groupOnly:    'Este comando no funciona aquí en privado, úsalo en un grupo donde tenga sentido.',
  privateOnly:  'Esto es mejor hablarlo en privado, no en medio de un grupo donde todos leen.',
  adminOnly:    'Solo los administradores pueden hacer eso, y tú por ahora no lo eres.',
  notAdmin:     'No tienes permisos para hacer eso aquí. Si crees que deberías tenerlos, habla con los admins.',
  botNotAdmin:  'Me gustaría ayudarte, pero necesito ser administradora del grupo para poder hacer eso.',

  // ─── Protecciones ───────────────────────────────────────────────────────────
  antiLink:     'Aquí no se comparten enlaces, eso está claro desde el principio. Por favor respeta las reglas del grupo.',
  spamWarn:     'Tranquilo, espera {secs} segundos antes de volver a intentarlo. No va a pasar nada si esperas un momento.',
  mutedUser:    'Estás silenciado por ahora, así que no voy a procesar tus comandos hasta que eso cambie.',

  // ─── Owner ──────────────────────────────────────────────────────────────────
  botOff:         'Me voy a descansar, fue un día largo y creo que me lo merezco. Hasta pronto.',
  botRestart:     'Voy a reiniciarme un momento. No es nada grave, vuelvo enseguida.',
  maintenanceOn:  'Activé el modo mantenimiento, así que por ahora solo Hernandez puede hablar conmigo. Los demás van a tener que esperar.',
  maintenanceOff: 'El mantenimiento terminó y ya estoy de vuelta, funcionando como si nada hubiera pasado.',
  broadcastSent:  'El mensaje llegó a {count} grupos sin ningún problema. Misión cumplida.',
  broadcastFail:  'Algunos grupos no recibieron el mensaje por alguna razón que no puedo explicar bien. Algo falló en el camino.',
  broadcastEmpty: 'No me dijiste qué quieres transmitir. Dime el mensaje y lo mando sin problema.',
  banSuccess:     'Ya no voy a dejar que esa persona me use.',
  banAlready:     'Esa persona ya estaba en mi lista desde antes, no hay nada nuevo que agregar.',
  unbanSuccess:   'Le di otra oportunidad, espero que esta vez las cosas sean diferentes.',
  unbanNotFound:  'Esa persona no estaba baneada, así que no había nada que hacer aquí.',
  bannedWarn:     'No voy a dejarte usarme, estás en mi lista negra. Si crees que es un error, habla con mi owner.',
  leftGroup:      'Me fui del grupo. No sé si me van a extrañar, pero fue un placer mientras duró.',
  prefixChanged:  'Anotado, ahora me llamas con {prefix}. No se te olvide o no voy a responder.',
  ownerChanged:   'Nuevo creador registrado. Espero que sepa lo que está haciendo.',
  imageChanged:   'Mi foto de perfil fue actualizada. Hernandez tiene buen gusto, o al menos eso espero.',
  backupDone:     'Backup guardado sin problema. Todo está a salvo por si algo sale mal después.',
  restoreDone:    'Base de datos restaurada, todo volvió a su lugar como si nada hubiera pasado.',
  restoreFail:    'Algo salió mal con la restauración. Revisa bien el archivo e intenta de nuevo.',

  // ─── Admin ──────────────────────────────────────────────────────────────────
  banGroupSuccess:   'Listo, lo saqué del grupo. No sé qué hizo, pero algo hizo para llegar a esto.',
  banGroupFail:      'No pude expulsarlo, probablemente porque no tengo los permisos necesarios en este grupo.',
  unbanGroupSuccess: 'Ya puede volver al grupo cuando quiera. Ojalá las cosas sean diferentes esta vez.',
  muteSuccess:       'Lo silencié, que descanse la voz un rato y piense bien las cosas.',
  unmuteSuccess:     'Ya puede volver a hablar. Espero que esta vez sea para algo bueno.',
  warnMsg:           '@{user} ya llevas {count} de 3 advertencias. No sé qué esperas para cambiar el rumbo.',
  warnExpelled:      '@{user} llegó a 3 advertencias y lo tuve que silenciar. No dije que no avisé.',
  warnReset:         'Las advertencias de @{user} fueron reiniciadas. Empezamos desde cero, pero no lo olvides.',
  deleteSuccess:     'Mensaje eliminado, como si nunca hubiera existido.',
  deleteFail:        'No pude eliminar ese mensaje, algo me lo impidió. Revisa mis permisos en el grupo.',
  replyNeeded:       'Responde al mensaje que quieres usar con este comando, no puedo adivinar cuál es.',
  userNeeded:        'Menciona a alguien o responde su mensaje para que sepa con quién estamos trabajando.',

  // ─── Grupo ──────────────────────────────────────────────────────────────────
  notIgnored:       'Ese usuario ni siquiera estaba ignorado en este grupo.',
  ignoredTitle: 'IGNORADOS',
  unignoreSuccess:  'Listo, @{num} ya puede volver a usar mis comandos con normalidad.',
  noIgnoredUsers:   'No tengo a nadie ignorado en este grupo por ahora.',
  demoteSuccess: 'Ya le quité el rango de administrador a @{num}.',
  cannotDemoteCreator: 'No puedo quitarle el rango al creador del grupo, él manda aquí.',
  descNeeded: 'Dime qué descripción quieres poner en el grupo.',
  groupNameChanged:  'El grupo ya tiene nuevo nombre, espero que a todos les guste.',
  groupDescChanged:  'La descripción del grupo fue actualizada sin ningún problema.',
  groupPhotoChanged: 'La foto del grupo fue cambiada, a ver si esta les convence más.',
  groupOpened:       'El grupo está abierto, todos pueden escribir libremente desde ahora.',
  groupClosed:       'El grupo está cerrado, por ahora solo los administradores pueden escribir.',
  inviteGenerated:   'Aquí está el enlace de invitación, compártelo con quien quieras: https://chat.whatsapp.com/{code}',
  inviteConfirm:     'El enlace anterior va a dejar de funcionar si continúas. Confirma que es lo que quieres hacer.',
  adminModeOn:       'Modo administrador activado, por ahora solo ellos pueden usar mis comandos.',
  adminModeOff:      'Modo administrador desactivado, todos pueden volver a participar con normalidad.',
  antilinkOn:        'Antilink activado, no voy a permitir que se compartan enlaces en este grupo.',
  antilinkOff:       'Antilink desactivado, ya pueden compartir enlaces sin problema.',

 // ─── Registro automático ────────────────────────────────────────────────────
  autoRegistered:       '> Hola, soy Midori-Hana🌴\n\nTe escribo porque usas el bot por primera vez, así que tomé la decisión de registrarte como *{nombre}*.\n\nPuedes ver tu perfil actual con *.perfil* o cambiarlo cuando quieras con *.setperfil*, no te quedes con algo que no te gusta.',
  autoRegisteredRandom: 'Hola, soy Midori 🌸\n\nNo encontré tu nombre en WhatsApp, así que tomé la decisión de registrarte como *{nombre}*.\n\nPuedes ver tu perfil actual con *.perfil* o cambiarlo cuando quieras con *.setperfil*, no te quedes con algo que no te gusta.',

  // ─── Economía ───────────────────────────────────────────────────────────────
  ecoDisabled:      'La economía está desactivada en este grupo, así que por ahora no puedo procesar eso.',
  notEnoughKryons:  'No tienes suficientes kryons para hacer eso. Trabaja un poco más y vuelve cuando tengas.',
  bankEmpty:        'Tu banco está completamente vacío. Deposita algo antes de intentar retirar, que no funciona así.',
  cooldownMsg:      'Espera {secs} segundos antes de volver a usar ese comando. No todo puede hacerse de golpe.',
  noKryons:         'No tienes kryons suficientes para eso. Así no va a funcionar.',
  stealFail:        'Te atraparon con las manos en la masa. Qué pena, la verdad, no fue tu mejor momento.',
  stealSuccess:     'Le robaste {amt} kryons a @{user} y saliste limpio. No sé si felicitarte o preocuparme.',

  // ─── Niveles y rangos ───────────────────────────────────────────────────────
  levelUp:  '🌸 *{nombre}* acaba de subir al nivel *{nivel}*. Al final sí se puede cuando uno se lo propone de verdad.',
  rankUp:   '🌸 *{nombre}* llegó al rango *{rango}* y eso no se logra de la noche a la mañana. Aquí van *{recompensa}* kryons, bien merecidos cada uno.',

  // ─── Búsquedas ──────────────────────────────────────────────────────────────
  busquedaEmpty:    'Dime qué quieres que busque, porque no soy adivina y no pienso intentarlo.',
  busquedaNotFound: 'No encontré nada con eso que me diste. Intenta con otras palabras a ver si hay suerte.',
  descargaError:    'No pude descargar eso. Revisa que el enlace esté bien escrito e intenta de nuevo.',
}

global.messages = messages
export default messages