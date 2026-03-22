export default {
  botName: 'kari',
  ownerName: 'HERNANDEZ',
  ownerNumbers: ['5049692615'],
  botNumber: '50432821762', // Número del bot para pairing code
  useQR: true, // true = QR, false = código de 8 dígitos
  prefix: '.',
  sessionName: 'kari-session', //sesion del kari
  autoRead: true, //lectura automatica de mensajes
  autoBio: true, //actualizar estado de whastapp
  antiCall: true, //bloquear llamadas entrantes
  allowPrivate: false, //permitir o prohibir el uso de comandos en privado
  grupoOficial: 'https://chat.whatsapp.com/K2cIBxrPhPF1WLpLBhEIN0',
  soporte: 'https://wa.me/50496926150',
  moneda: 'kryons',
  wm: '© kari bot', //descripcion de stickers
  
  // Bienvenidas y despedidas
  welcomeMessage: true, // Activar mensajes de bienvenida/salida
  welcomeText: '👋 Bienvenido {name} al grupo 🍃', // {name} se reemplaza por el nombre
  goodbyeText: '👋 {name} salió del grupo 🌿' // {name} se reemplaza por el nombre
}