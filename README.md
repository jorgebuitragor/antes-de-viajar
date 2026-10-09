# Antes de viajar

Lista compartida de pendientes. Servidor Node sin dependencias; la lista se guarda en `/data/items.json`.

## Correr con Docker

    docker compose up -d --build

Abre http://localhost:3000 (o la IP del servidor). La lista queda en el volumen `viaje-data`, así que sobrevive a reinicios y reconstrucciones.

## Sin Docker

    node server.js        # PORT y DATA_DIR opcionales

## Notas
- Sin login: cualquiera que llegue a la URL puede editar. Ponlo detrás de tu VPN, de un proxy con contraseña o solo en tu red local.
- Los dispositivos se sincronizan cada 5 segundos.
