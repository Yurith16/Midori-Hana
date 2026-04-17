#!/bin/bash

# Configurar nombre y email de GitHub
git config --global user.name "Midori-Hana"
git config --global user.email "yuseubia@gmail.com"

# Configurar token de autenticación
git config --global credential.helper store
git remote set-url origin https://Yurith16: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@github.com/Yurith16/Midori-Hana.git

# Crear alias para commit personalizado
git config --global alias.mc 'commit -m "🌸⃟™ 𝑴𝒊𝒅𝒐𝒓𝒊-𝑯𝒂𝒏𝒂 𝑶𝒇𝒊𝒄𝒊𝒂𝒍 ™⃟🌸"'

# Crear alias para update (pull y reinicio)
git config --global alias.up '!git pull && echo "✅ Bot actualizado"'

# Mensaje de éxito
echo "✅ Midori-Hana configurado globalmente"
echo "📝 Usa 'git mc' para hacer commits"
echo "🔄 Usa 'git up' para actualizar el bot"