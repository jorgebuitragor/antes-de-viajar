# Listas de la casa

Listas compartidas (viaje, súper, pendientes de la casa, lo que sea) para dos personas. Servidor Node sin dependencias; todo se guarda en `/data/items.json`.

- Varias listas, con pestañas; se crean, renombran y eliminan desde la propia página.
- Cada ítem se puede editar, asignar (Mafer / Jorge / Ambos), marcar, buscar, filtrar y **reordenar arrastrando** el asa ⠿ (también con el teclado: enfoca el asa y usa las flechas arriba/abajo).
- Cada lista tiene su propio enlace (`/#<id-de-la-lista>`).

## Correr con Docker

    docker compose up -d --build

Abre http://localhost:3000 (o la IP del servidor). Los datos quedan en el volumen `viaje-data`, así que sobreviven a reinicios y reconstrucciones.

## Sin Docker

    node server.js        # PORT y DATA_DIR opcionales

## Datos
Formato: `{ "lists": [{ "id", "name", "items": [{ "id", "t", "d", "r" }] }] }`. Si `items.json` viene del formato anterior (un arreglo plano de ítems), al arrancar se convierte solo en la lista "Antes de viajar" y se deja una copia en `items.json.v1.bak`.

## Notas
- Sin login: cualquiera que llegue a la URL puede editar. Ponlo detrás de tu VPN, de un proxy con contraseña (en Gaia, Cloudflare Access) o solo en tu red local.
- Los dispositivos se sincronizan cada 5 segundos.
