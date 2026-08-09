# Recordatorio diario — Spec

Un único push diario, alrededor de las 11:00 (Argentina), que invita a registrar el
humor del día. **No es un recordatorio condicional** ("si no completaste, te aviso de
nuevo a la noche") — eso quedó descartado a propósito: choca con la decisión de no
gamificar ni insistir (SPEC.md §6.4, §9). Es hábito, no presión: un aviso por día, y
listo.

Este documento es el plan de implementación. Complementa a SPEC.md (qué es la app) y
CONVENTIONS.md (cómo se instala/mantiene) con la parte que es enteramente nueva:
la primera pieza de infraestructura que el proyecto tiene fuera del dispositivo.

---

## 1. Por qué hace falta un servidor

Ni iOS ni Android dejan que una PWA programe sola una notificación local que se
dispare estando cerrada. Eso solo existe vía **Web Push**: un servidor le pide a
Apple/Google que le entregue un mensaje a un dispositivo específico, en el momento
que el servidor decida. No hay atajo cliente-only para esto.

### Lo que NO cambia

- **El humor y el ciclo siguen siendo 100% locales.** Lo único que sale del
  dispositivo es la suscripción de push (un token opaco que identifica "este
  dispositivo, en este navegador, quiere recibir avisos") — nunca los datos de
  la app.
- Sin cuenta, sin login. La suscripción por sí sola es la única "identidad".

### Lo que sí cambia

Por primera vez, algo corre 24/7 fuera del dispositivo. Es un cambio de arquitectura
real, aunque acotado — hay que decirlo en la UI (§6) y no tratarlo como un detalle.

---

## 2. Stack elegido y por qué

Ya verificado contra la documentación actual de Vercel (agosto 2026):

| Pieza | Elección | Por qué |
|---|---|---|
| Hosting | **Vercel** (ya conectado al repo, deploya solo) | Cero infra nueva que aprender — mismo proyecto |
| Programador | **Vercel Cron Jobs**, plan Hobby | El plan gratis solo permite 1 corrida/día, sin precisión de minuto — es exactamente lo que se necesita para un aviso diario único. No hace falta plan Pro. |
| Guardado de suscripciones | **Upstash Redis** vía Vercel Marketplace | Vercel KV se discontinuó (dic. 2024); Upstash es su reemplazo oficial, un click desde el dashboard de Vercel, capa gratis de sobra para esto |
| Envío del push | **`web-push`** (npm) | Firma el mensaje con las claves VAPID; es la librería de referencia para Web Push en Node |
| Zona horaria | **Fija, hardcodeada** (Argentina, UTC-3) | Es para un uso personal, no multi-usuario en distintas zonas — guardar timezone por dispositivo sería complejidad sin beneficio real hoy |

> Las versiones exactas de `web-push` y cualquier otra dependencia se fijan al
> instalar, tomando la última publicada hace ≥ 7 días (CONVENTIONS.md §3).

---

## 3. Arquitectura

```
┌─────────────┐      1. toggle "Recordarme"       ┌──────────────────────┐
│   PWA        │ ──────────────────────────────▶  │ POST /api/subscribe   │
│ (Service     │      (subscription + endpoint)    │ → guarda en Upstash   │
│  Worker)     │                                   └──────────────────────┘
│              │
│              │      3. push llega                ┌──────────────────────┐
│              │ ◀────────────────────────────────  │ Vercel Cron          │
│              │      2. cron dispara a las 14:00   │ (14:00 UTC = 11:00   │
│              │      UTC → GET /api/send-reminder  │  Arg) diariamente    │
└─────────────┘         → lee Upstash, manda push   └──────────────────────┘
```

### Archivos nuevos

```
vercel.json                    # config del cron job
api/subscribe.ts                # POST — guarda la suscripción del dispositivo
api/unsubscribe.ts              # POST — la borra (al apagar el toggle)
api/send-reminder.ts            # GET, llamado solo por el cron — manda el push
src/sw.ts                       # service worker propio (reemplaza el autogenerado)
src/features/settings/          # + toggle "Recordarme a la mañana"
  NotificationToggle.tsx
src/push/subscribe.ts           # lógica cliente: pedir permiso, suscribirse
```

### Archivos que cambian

- `vite.config.ts` — `vite-plugin-pwa` pasa de `strategies: 'generateSW'` (automático)
  a `strategies: 'injectManifest'` con `srcDir: 'src'`, `filename: 'sw.ts'`: necesito
  controlar el archivo del service worker para escuchar el evento `push`. El plugin
  sigue encargándose del precache de assets — eso no se pierde.
- `src/features/settings/SettingsScreen.tsx` — agrega la sección del toggle.
- `package.json` — nueva dependencia de servidor (`web-push`) y de tipos.

---

## 4. Modelo de datos (en Upstash, no en el dispositivo)

```ts
type PushSubscriptionRecord = {
  id: string;              // hash del endpoint, para poder borrarla después
  subscription: PushSubscriptionJSON;  // lo que devuelve PushManager.subscribe()
  createdAt: number;
};
```

Se guarda como **una lista** (`SADD`/`LPUSH` en Redis), no un solo registro — para
soportar más de un dispositivo instalado (tu teléfono y, si corresponde, otro) sin
tener que rediseñar nada. `send-reminder` recorre la lista entera y le manda el push
a cada suscripción.

Si un envío falla con status 404/410 (la suscripción expiró o el usuario desinstaló
la PWA), `send-reminder` la borra de la lista sola — sin esto, Upstash acumula
suscripciones muertas para siempre.

---

## 5. Flujo del lado del cliente

1. En Ajustes, un toggle **"Recordarme a la mañana"**, apagado por default (pedir
   permiso de notificaciones nunca puede ser automático — tiene que salir de un tap).
2. Al activarlo:
   - `Notification.requestPermission()` — si el usuario lo rechaza, el toggle vuelve
     a apagarse y se explica que puede habilitarlo después desde los ajustes del
     navegador/sistema.
   - `serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true,
     applicationServerKey: VAPID_PUBLIC_KEY })`.
   - `POST /api/subscribe` con el resultado.
3. Al desactivarlo: `pushManager.getSubscription()` → `.unsubscribe()` en el
   navegador, y `POST /api/unsubscribe` para que el servidor la borre también.
4. El service worker (`src/sw.ts`) escucha:
   - `push` → `self.registration.showNotification('¿Cómo estuvo tu día?', { body:
     '...', icon: '/icon-any-192.png', badge: '/favicon.svg' })`.
   - `notificationclick` → abre/enfoca la PWA en la pantalla de Hoy.

### iOS: lo que hay que respetar

- Solo funciona si la PWA está **agregada a la pantalla de inicio** (modo
  standalone) — en una pestaña normal de Safari, Web Push no está disponible.
  El toggle debe detectar esto (`window.matchMedia('(display-mode: standalone)')`)
  y, si no está instalada, mostrar "instalá la app primero" en vez del toggle.
- Requiere iOS 16.4+. Si `!('PushManager' in window)`, ocultar el toggle
  directamente en vez de mostrar un error.

---

## 6. Copy y privacidad (ubicación: Ajustes, junto al toggle)

> "Para poder avisarte, tu dispositivo se registra en un servidor — no se manda tu
> humor ni tu ciclo, solo un aviso a la hora que elijas."

Una frase, visible antes de activar el toggle, no escondida en un legal aparte.

---

## 7. Qué necesito de vos antes de escribir código

No puedo tocar tu cuenta de Vercel ni generar claves privadas que después vos no
controlás. Antes de implementar:

1. **Agregar la integración de Upstash** desde el dashboard de Vercel: proyecto
   `celimood` → *Storage* → *Marketplace Database Providers* → *Upstash* → crear una
   base Redis. Vercel inyecta las variables de entorno solo (`KV_REST_API_URL`,
   `KV_REST_API_TOKEN` o el nombre equivalente que use Upstash en ese momento —
   confirmar el nombre exacto una vez creada).
2. **Generar las claves VAPID.** Esto sí lo hago yo, localmente, con
   `npx web-push generate-vapid-keys` — no sale nada afuera. Te doy la clave privada
   para que la pegues en *Vercel → Project Settings → Environment Variables* como
   `VAPID_PRIVATE_KEY`. La pública va al código del cliente (no es secreta).
3. Confirmar el horario exacto que querés (asumo 11:00 Argentina = 14:00 UTC salvo
   que digas otra cosa — y ojo, Argentina no cambia hora estacional, así que ese
   offset de -3 es fijo todo el año, no hay que ajustarlo).

---

## 8. Plan de implementación (orden sugerido)

| Paso | Qué |
|---|---|
| 1 | Vos: crear la integración de Upstash en Vercel (§7.1) |
| 2 | Yo: generar claves VAPID, pasarte la privada para que la agregues a Vercel |
| 3 | `vite.config.ts` → `injectManifest` + `src/sw.ts` con los listeners de push |
| 4 | `api/subscribe.ts` + `api/unsubscribe.ts` — endpoints mínimos, sin auth (el
      endpoint de push en sí ya es la única credencial que importa) |
| 5 | Toggle en Ajustes + `src/push/subscribe.ts` (permiso + suscripción) |
| 6 | `api/send-reminder.ts` + `vercel.json` con el cron |
| 7 | Probar en Android real primero (más simple de depurar); después iOS instalado |
| 8 | Actualizar SPEC.md §9: mover "¿Recordatorio diario?" de abiertas a cerradas |

---

## 9. Qué NO incluye esto (a propósito)

- **Sin recordatorio condicional a la noche.** Descartado en la conversación que dio
  origen a este documento: rompe la idea de "una invitación, no una insistencia".
- **Sin zona horaria configurable por ahora.** Si en el futuro esto lo usa alguien en
  otro huso horario, se agrega guardando el timezone en el mismo registro de Redis —
  cambio chico, pero no vale la pena hacerlo hoy sin necesidad real.
- **Sin panel de administración.** Dos endpoints y un cron; no hace falta más para
  esta escala.
