# Verificación local — 3 de septiembre de 2026

- HTML original guardado en `recursos/original.html` (47.842 bytes).
- 75 recursos públicos descargados, con manifiesto de procedencia.
- `npm run build`: correcto.
- `npm test`: 3 pruebas correctas (fórmulas, servidor HTTP y recursos).
- `/`, `/en`, `/en/` y `/health`: respuestas HTTP 200.
- Comprobadas las rutas de los 75 recursos y las referencias locales del CSS.
- Vista de escritorio y vista móvil revisadas en el navegador local.
- Carrusel, selección de banners y pausa comprobados.
- Menús de escritorio y móvil comprobados; corregido el área activa del botón móvil.
- Búsqueda local comprobada con «cards».
- Calculadora de crédito: 12.000 / 12 meses / 0% = 1.000,00 TL.
- Buscador de sucursales: selección de Istanbul y Kadıköy mostrada correctamente en el diálogo local.
- Aviso de cookies: cierre y persistencia tras recargar comprobados.
- Sin imágenes rotas ni errores de consola detectados.

Las pruebas no envían solicitudes a la banca por Internet ni realizan operaciones bancarias. Se incluyen Dockerfile y configuración Railway, pero no se realizó ningún despliegue ni se ejecutó una compilación Docker.

## Páginas públicas adicionales

- Ocho HTML adicionales guardados en `recursos/pages`.
- 131 recursos públicos incluidos en total.
- Rutas locales verificadas: Product and Service Fees, Our Bank, Investor Relations, Digital Banking, Retail, Commercial, Corporate y portada en turco.
- La página Our Bank fue revisada visualmente en móvil; no presentó imágenes rotas.
- Internet Banking se mantiene como enlace al sitio oficial y no se reprodujeron pantallas transaccionales.
