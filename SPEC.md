# Celimood — Spec & Plan

App para registrar el humor del día, ver el histórico de forma clara y divertida,
filtrar días por humor, y (fase 2) trackear el período menstrual.

---

## 1. Visión

Una app **local-first**, instalable en el celular, donde registrar cómo estuvo el día
toma **un solo tap**. El valor no está en el formulario: está en lo que devuelve
después — un calendario que se lee de un vistazo, tendencias honestas, y la relación
entre humor y ciclo, que es la razón por la que ambas cosas viven en la misma app.

Principios:

1. **Registrar es instantáneo.** Si loguear el día cuesta más de 3 segundos, el hábito
   muere y el histórico queda vacío. Todo lo demás (notas, tags, energía) es opcional.
2. **El histórico es el premio.** La app tiene que dar ganas de abrirla aunque hoy ya
   hayas registrado.
3. **Los datos son tuyos.** No salen del dispositivo. Sin cuenta, sin servidor.
4. **Divertida, no infantil.** Personalidad vía color, movimiento y microcopy — no vía
   ruido visual.

---

## 2. Decisiones tomadas

| Decisión | Elección | Por qué |
|---|---|---|
| Plataforma | **PWA instalable** (React web) | Un tap desde el home, funciona offline, sin app stores |
| Datos | **Solo local (IndexedDB), sin cuenta** | Privacidad de datos de salud + cero backend/infra |
| Backup | **Export / import de JSON** | Reemplaza al sync sin traer un servidor |
| Orden | **Humor primero, ciclo después** | El ciclo se apoya en el modelo de datos del humor |

### Supuesto explícito sobre privacidad

Los datos de ciclo menstrual son **datos de salud sensibles**. Mantenerlos on-device,
sin cuenta, es a la vez la postura correcta de privacidad y una simplificación enorme
(no hay backend, ni auth, ni infra, ni obligaciones de custodia). El costo real es que
**si se pierde el dispositivo o se borran los datos del navegador, se pierde el
histórico** — por eso el export a JSON no es un extra, es parte del v1.

Si más adelante se quiere sync entre dispositivos, eso mete datos de salud en un
servidor y entra en territorio regulado (GDPR/datos de salud, cifrado en reposo,
borrado real). Merece su propio pase de diseño, no se resuelve agregando un login.

### Descargo

Las predicciones de ciclo son **estimaciones estadísticas**, no diagnóstico. La UI lo
tiene que decir donde aparecen, y la app nunca debe usarse como método anticonceptivo.

---

## 3. Alcance por fases

### v1 — Humor (el núcleo)
- Registro diario de humor (1 tap) + energía, tags y nota opcionales
- Editar / borrar el registro de cualquier día
- Calendario mensual tipo heatmap
- Vista "Días por humor": chips de filtro → lista de días
- Tendencias básicas: promedio de humor, días registrados en el mes, distribución
- Export / import JSON
- Tema claro / oscuro
- PWA instalable + offline

### v2 — Ciclo
- Registro de flujo por día (ninguno / manchado / leve / medio / abundante)
- Síntomas por día (cólicos, dolor de cabeza, hinchazón, acné, antojos…)
- Detección automática de períodos y cálculo de duración de ciclo
- Predicción del próximo período (con rango, no una fecha falsamente precisa)
- Overlay del ciclo sobre el calendario de humor

### v3 — Insights (el cruce)
- ✅ Humor promedio por **fase del ciclo** (menstrual / folicular / ovulatoria / lútea)
- ✅ Humor promedio por **tag** ("dormí mal" → -0.8 de humor promedio)
- ✅ Humor por día de la semana
- Resumen mensual compartible (imagen exportada, sin datos crudos) — pendiente

### Fuera de alcance (por ahora)
Cuentas y sync, integración con Apple Health /
Google Fit, multi-usuario, IA que interprete las notas.

> El recordatorio diario por push **sí** entró en alcance — es la primera pieza de
> infraestructura fuera del dispositivo del proyecto. Plan completo en
> `NOTIFICATIONS.md`.

---

## 4. Modelo de datos

Esto es la columna vertebral: todas las vistas dependen de acertarle acá.

### Regla crítica: la clave es la fecha local, no un timestamp

```ts
// "YYYY-MM-DD" en zona horaria LOCAL. Tipo marcado: un string cualquiera no entra
// donde va un DateKey — toda construcción pasa por domain/dates.ts
// (ver CONVENTIONS.md §7).
type DateKey = string & { readonly __brand: 'DateKey' };
```

Guardar un `Date` o un ISO timestamp UTC hace que un registro de las 23:00 caiga en el
día siguiente para cualquiera que no esté en UTC — y eso rompe **el calendario, la
cobertura y el cruce con el ciclo a la vez**. La clave primaria es siempre la fecha local
como string. Bonus: "días por humor" se vuelve un filtro trivial y el calendario un
lookup de un `Map`.

### MoodEntry — un registro por día (upsert, nunca duplica)

```ts
type MoodEntry = {
  date: DateKey;          // PK
  mood: 1 | 2 | 3 | 4 | 5;
  energy?: 1 | 2 | 3 | 4 | 5;
  tags: string[];         // ids de tag
  note?: string;          // texto libre, opcional
  createdAt: number;      // epoch ms
  updatedAt: number;
};
```

### CycleDay — se loguean días, los ciclos se derivan

```ts
type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

type CycleDay = {
  date: DateKey;          // PK
  flow: Flow;
  symptoms: string[];     // ids de síntoma
  note?: string;
};
```

**No se guardan "ciclos" como entidad.** Se guardan días y se derivan.

#### Regla crítica #2: "sin registrar" ≠ `flow: 'none'`

Un día sin `CycleDay` está **ausente** de la base, no es un día con flujo cero. Son
dos cosas distintas y confundirlas rompe todo lo que viene después:

```
día 1  flow: heavy     ✔ logueado
día 2  flow: medium    ✔ logueado
día 3  flow: light     ✔ logueado
día 4  (ausente)       ← se olvidó de loguear
día 5  flow: light     ✔ logueado
```

Si "ausente" se lee como `none`, el período se parte en dos. Y como la duración del
ciclo se mide **entre inicios de período**, aparece un ciclo fantasma de ~2 días que
entra a la mediana y arruina las predicciones durante meses.

Reglas, entonces:

- **Período** = corrida máxima de días con flujo, donde la tolerancia de hueco
  (por defecto 1 día, configurable) aplica **solo a días ausentes**. Un `flow: 'none'`
  explícito es evidencia real de que el período terminó y **corta la corrida**.
- **Duración del ciclo** = días entre inicios de períodos consecutivos.
- **Filtro de plausibilidad**: cualquier ciclo derivado de **< 15 o > 60 días** se
  descarta como input de la mediana (se sigue mostrando en el histórico, marcado como
  atípico). Es la red de seguridad ante huecos de registro largos.
- **Predicción** = **mediana** de los últimos 3–6 ciclos plausibles, no el promedio.

> Por qué mediana: un ciclo atípico (estrés, enfermedad, viaje) arrastra el promedio y
> deja la predicción mal calibrada durante meses. La mediana lo ignora.

Si la varianza entre ciclos es alta (rango intercuartílico > ~4 días), la UI muestra
un **rango** ("entre el 12 y el 16") en vez de un día único. Con menos de 2 ciclos
registrados, no se predice nada — se dice "necesito un ciclo más para estimar".

### Tag y Symptom

```ts
type Tag = { id: string; label: string; emoji: string; archived: boolean };
```

Set por defecto editable: `sueño`, `trabajo`, `social`, `ejercicio`, `familia`,
`pareja`, `ocio`, `clima`. El usuario puede crear los suyos.

> `dinero` y `salud` estaban en una versión anterior y se sacaron: no calzaban
> con el resto de la lista para un tracker de humor. Se archivan (no se
> borran) en bases que ya los tenían sembrados, para no perder el dato de
> entries históricos que los usaban.

### Settings

```ts
type Settings = {
  theme: 'system' | 'light' | 'dark';
  cycleTrackingEnabled: boolean;  // activado por defecto (ver §9 cerradas)
  weekStartsOn: 0 | 1;            // domingo | lunes
  reminderTime?: string;          // "21:00", notificación local
};
```

### Fases del ciclo (derivadas, v3)

```ts
type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown';
```

Se calculan desde el inicio del último período y la duración mediana del ciclo. Son
**estimaciones** y la UI las etiqueta como tales — sin test de ovulación no hay
certeza. Cualquier día fuera de un ciclo conocido es `unknown` y se excluye de las
estadísticas por fase en vez de asumirle una.

---

## 5. Pantallas

Navegación: tab bar inferior de 4 items (Hoy · Calendario · Insights · Ajustes).
El registro del ciclo vive dentro de Hoy y Calendario, no como tab separada — son el
mismo día, no dos apps.

### 5.1 Hoy — la pantalla principal

No es un dashboard. Es un botón grande.

```
┌─────────────────────────────┐
│  Sábado 8 de agosto         │
│                             │
│  ¿Cómo estuvo tu día?       │
│                             │
│   😖   😕   😐   🙂   😄     │  ← 5 caras grandes, tocables
│                             │
│  ─── al elegir, se expande ─┤
│  Energía   ▁▃▅▇█            │
│  Tags      #sueño #trabajo  │
│  Período   🩸 #cólicos      │  ← si el tracking de ciclo está activo
│  Nota      [ opcional ]     │
└─────────────────────────────┘
```

- Tocar una cara **guarda inmediatamente**, con feedback óptico al toque — no
  espera la vuelta de IndexedDB (ver nota de optimistic UI abajo). Todo lo de
  abajo es opcional y aparece después, no antes.
- Si el día ya está registrado: muestra lo elegido, tocar de nuevo lo cambia.
- Si hay días anteriores sin registrar, un banner discreto: *"Te faltan 2 días"* →
  lleva a un flujo de completado rápido. Nunca un modal bloqueante.

**Feedback optimista (corrige un bug real):** la cara seleccionada se marca al
toque mediante un estado local, sin esperar a que la escritura en IndexedDB
vuelva a través de la live query. Sin esto, el tiempo entre el tap y la
confirmación visual —aunque sea de milisegundos— se sintió como "hay que
tocar dos veces para que guarde". El estado optimista se descarta en cuanto
la lectura real de la base confirma el mismo valor.

**Período y síntomas van acá, no en una hoja aparte.** La primera versión los
escondía detrás de un botón "🩸 Registrar período" que abría un bottom sheet
con un selector de flujo de 5 niveles (nada/manchado/leve/medio/abundante).
Eso agregaba fricción justo donde tiene que haber menos: para que "Ver ciclo"
tenga datos, hace falta que alguien efectivamente marque el día, y un
selector de 5 opciones invita a posponerlo. Ahora es un solo chip **"🩸 Hoy
tengo período"** (on/off) al lado de los chips de síntomas, exactamente con
la misma interacción que los Tags. El modelo de datos no cambió — `CycleDay.flow`
sigue siendo el enum de 5 valores (§4) — la UI simplemente ya no lo expone:
marcar el chip en "on" escribe `flow: 'medium'` como valor representativo:
alcanza para que la detección de períodos funcione, y nadie tiene que elegir
una intensidad para simplemente decir "hoy es un día de período".

### 5.2 Calendario — el indicador + el heatmap

#### El indicador del mes (arriba de todo)

Esto es *el* indicador "bien user friendly" del histórico: una sola cosa que se lee en
menos de un segundo, antes de cualquier gráfico.

```
┌─────────────────────────────┐
│        🙂                   │   ← cara grande del promedio del mes
│    3.8  ↑ 0.4               │   ← promedio + delta vs. mes anterior
│    Agosto fue mejor que     │
│    julio · 26 de 31 días    │
└─────────────────────────────┘
```

- **Cara grande** = el promedio del mes redondeado al nivel más cercano.
- **Número + flecha** = promedio exacto y delta contra el mes anterior. La flecha va
  con color de estado **e** ícono, nunca color solo.
- **Una línea en texto plano** que dice qué significa. Un número sin lectura no es un
  indicador.
- **Cobertura** ("26 de 31 días") es obligatoria: un promedio calculado sobre 4 días
  no es comparable con uno sobre 30, y ocultarlo hace mentir al indicador. Con menos
  de ~40% de cobertura, la app muestra el promedio en gris y sin delta.

#### El heatmap

Grilla mensual. **Cada celda tiene que cargar humor y ciclo al mismo tiempo sin
volverse un barro visual.** Encoding fijo:

| Dato | Canal |
|---|---|
| Humor | **relleno** de la celda (escala divergente) |
| Período registrado | **barra inferior** dentro de la celda |
| Período predicho | **borde punteado** de la celda |
| Día sin registrar | **sin chip**: superficie desnuda, número del día en tinta apagada |
| Hoy | anillo de 2px |

Un canal por dato, sin superponer dos rellenos. Tocar un día abre un bottom sheet con
el detalle y permite editarlo.

**Por qué la celda vacía no lleva ni relleno ni borde:** un día registrado es un chip
redondeado con relleno; un día sin registrar es la *ausencia* del chip. La distinción
es de **forma y presencia**, no de color — así ningún ajuste futuro de paleta puede
volver a confundir "Normal" con "sin datos" (ver §6.2). Un hairline gris tenue sí
podía, y de hecho lo hacía.

Debajo: fila de mini-stats del mes (promedio, mejor día, días registrados).

### 5.3 Días por humor

La vista que pidió el usuario explícitamente.

- Fila de chips arriba: `😖 4` `😕 9` `😐 12` `🙂 21` `😄 7` — el número es la cantidad
  de días. Se pueden activar varios a la vez.
- Filtros secundarios: por tag, por rango de fechas, por fase del ciclo (v3).
- Abajo, lista de días: fecha, cara, tags, y preview de la nota. Tocar → detalle.
- Estado vacío con personalidad, no un "no hay resultados" seco.

### 5.4 Insights

**Todo lo que promedia o agrupa tiene un rango explícito, elegible con chips**
(30 días / 90 días / 1 año / Todo, default 30). Ningún cálculo es "todo el
historial" de forma implícita — la pregunta "¿esto en base a qué se pondera?"
no debería necesitar leer el código para responderse; el rango se ve arriba
de cada sección que depende de él, y el título de la sección lo repite
("Distribución · 30 días").

- **Tendencia de humor** en el tiempo (línea suavizada, sobre el rango elegido)
- **Distribución** de humor (barras horizontales por nivel, sobre el rango elegido)
- **Humor por tag** (desvío respecto del promedio *de ese mismo rango*, no del
  historial completo — mezclar ventanas distintas en la misma pantalla es lo
  que vuelve ilegible un insight)
- **Humor por fase del ciclo** (v3) — el insight estrella
- **Días registrados** este mes y en total — esto sí es explícitamente mensual
  y acumulativo (§6.4, no hay rachas), no depende del selector de rango

Cada gráfico incluye una lectura en texto plano debajo ("tu humor promedio en fase
lútea es 0.6 más bajo que el resto del mes"), porque un número solo no es un insight.

### 5.5 Ciclo (v2)

- Estado actual: "Día 14 de tu ciclo · fase folicular (estimada)"
- Próximo período estimado, con rango y nivel de confianza
- Histórico de ciclos: duración de cada uno, con la mediana marcada
- El registro de período y síntomas vive en Hoy, no acá (§5.1) — esta pantalla
  es de lectura, no de registro

### 5.6 Ajustes

Tema · Inicio de semana · Recordatorio diario · Tags y síntomas personalizados ·
Activar/desactivar tracking de ciclo · **Exportar JSON** · **Importar JSON** ·
Borrar todos los datos (con confirmación tipeada).

#### Semántica del import (importa definirla: es el único camino de restore)

El JSON trae registros con `DateKey` que pueden chocar con los que ya están. La app
pregunta explícitamente, no elige por su cuenta:

- **Fusionar (por defecto)** — se agregan los días que no existen localmente; ante un
  conflicto gana el registro con `updatedAt` más reciente.
- **Reemplazar todo** — se borra lo local y se escribe el archivo tal cual.

Antes de aplicar, se muestra un resumen: *"12 días nuevos, 3 en conflicto, 140 sin
cambios"*. El archivo se valida contra el esquema antes de tocar la base; un JSON
inválido no puede dejar la base a medias (todo el import va en una transacción).

---

## 6. Sistema de diseño

### 6.1 La escala de humor — el elemento más importante de la app

5 niveles. Cada nivel se identifica por **tres canales simultáneos**:

| Nivel | Nombre | Cara | Rol de color |
|---|---|---|---|
| 1 | Horrible | 😖 | polo cálido, paso fuerte |
| 2 | Mal | 😕 | polo cálido, paso claro |
| 3 | Normal | 😐 | **gris neutro** |
| 4 | Bien | 🙂 | polo frío, paso claro |
| 5 | Genial | 😄 | polo frío, paso fuerte |

**Por qué 5 y no 1–10:** una escala de 10 obliga a deliberar ("¿fue un 6 o un 7?") y
eso rompe el "un tap". 5 niveles con nombre son inmediatos y el histórico queda más
comparable. La alternativa (slider continuo 0–100) queda anotada como opción si el
usuario prefiere granularidad — pero entonces el calendario necesita bucketing igual
para ser legible.

### 6.2 Color

El humor es una escala **divergente** (mal ↔ bien) con un centro neutro real. Reglas
que no se negocian:

- **Divergente = dos hues opuestos + gris neutro en el medio.** Nunca un arcoíris,
  nunca un hue en el punto medio.
- **Nunca rojo↔verde.** Es el par que más falla en daltonismo (~8% de los hombres) y
  es exactamente la trampa obvia para "mal ↔ bien". Se usa **rojo ↔ azul**, con gris
  en el centro: polos que leen como opuestos y sobreviven a la simulación de CVD.
- **El color nunca va solo.** Cada nivel lleva siempre cara + nombre + valor numérico
  disponible. Si la app se imprime en blanco y negro o la ve alguien con acromatopsia,
  se sigue leyendo.
- **Modo oscuro es una paleta elegida, no un flip automático.** Cada paso se re-elige
  contra la superficie oscura y se re-valida.

#### La escala validada (no elegir a ojo — estos valores están medidos)

Superficie clara `#fcfcfb`, oscura `#1a1a19`. Modo oscuro re-escalonado, no invertido.

```css
:root {
  --mood-1: #e34948;  /* Horrible */
  --mood-2: #ea8d86;  /* Mal      */
  --mood-3: #d3d0c5;  /* Normal   */
  --mood-4: #7aa6e0;  /* Bien     */
  --mood-5: #2a78d6;  /* Genial   */
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --mood-1: #e66767;  --mood-2: #9e5655;  --mood-3: #4a4a46;
  --mood-4: #3f699e;  --mood-5: #3987e5;
}}
:root[data-theme="dark"] {
  --mood-1: #e66767;  --mood-2: #9e5655;  --mood-3: #4a4a46;
  --mood-4: #3f699e;  --mood-5: #3987e5;
}
```

> Los valores oscuros se repiten **literalmente** en los dos scopes. No alcanza con
> el media query: ese cubre solo la preferencia del sistema operativo, y el toggle
> `data-theme` tiene que poder ganar en las dos direcciones (oscuro sobre SO-claro y
> claro sobre SO-oscuro). Es la omisión clásica que deja el toggle roto a la mitad.

Medidas (ΔE en OKLab ×100, simulación CVD Machado severidad 1.0):

| Chequeo | Claro | Oscuro | Gate |
|---|---|---|---|
| ΔL entre pasos adyacentes (mín.) | 0.117 | 0.107 | ≥ 0.06 ✓ |
| Polos 1↔5, visión normal | 32.3 | 29.0 | ≥ 15 ✓ |
| Polos 1↔5, **bajo CVD** | 21.8 | 19.2 | ≥ 8 ✓ |
| Pasos internos 2↔4, bajo CVD | 13.0 | 11.4 | ≥ 8 ✓ |
| Peor par adyacente, visión normal | 13.9 | 12.5 | ordinal ✓ |
| Contraste de los polos vs. superficie | 3.85 / 4.30 | 5.39 / 4.79 | ≥ 3:1 ✓ |
| Nivel 3 vs. superficie (día sin registrar) | 13.5 | 19.0 | ≥ 8 ✓ |

Notas de la derivación:

- El **neutro es un gris medio** (`#d3d0c5`), no casi-blanco. Con un neutro
  casi-blanco los niveles 2 y 4 caen a contraste ~1.7 y "Mal" termina pareciendo
  "sin datos". El nivel 3 es un valor real; la celda **vacía** es otra cosa.
- **El sexto estado del calendario es "sin registrar", y casi rompe la escala.** Con
  el neutro en `#dedcd4`, el nivel 3 quedaba a **ΔE 1.2** del hairline de una celda
  vacía: un día "Normal" y un día sin registrar eran el mismo color, en modo claro,
  justo en la vista cuyo único trabajo es leerse de un vistazo (en modo oscuro no
  pasaba — es una asimetría que mirando un screenshot oscuro no se detecta). Se
  arregló en dos frentes: el neutro se oscureció a `#d3d0c5` (ΔE 13.5 contra la
  superficie), **y** la ausencia dejó de codificarse con color — ver abajo.
- **Rojo↔verde fue evaluado y descartado con números**: la variante rojo↔aqua da ΔE
  bajo CVD de **6.8 (claro) / 6.5 (oscuro)** entre los polos — o sea, un daltónico
  no distingue "Horrible" de "Genial". Es exactamente la trampa obvia de un
  tracker de humor. Rojo↔azul da 21.8 / 19.2.
- El script que deriva y verifica todo esto ya está en el repo:
  `node tools/derive-mood-scale.mjs`. Imprime la escala elegida, todos los gates, y
  la comparación contra rojo↔verde. **Re-correrlo antes de tocar cualquier hue.**

**Color del período:** magenta `#e87ba4` (claro) / `#d55181` (oscuro). Pero el magenta
queda a solo **ΔE 7.8 del rojo `--mood-1` en modo oscuro**, así que:

- el período **nunca** es relleno de celda — va siempre como barra inferior;
- la barra lleva **un anillo de 2px del color de la superficie** que la separa del
  relleno de la celda. Sin ese anillo, una barra de período sobre un día "Horrible"
  se funde con el fondo en modo oscuro.

### 6.3 Charts

- Una sola escala por eje. **Nunca doble eje Y** — si hay dos medidas de escala
  distinta, son dos gráficos.
- Marcas finas, grilla y ejes recesivos, extremos de barra redondeados 4px.
- Tooltip en hover/tap por defecto en todos los gráficos.
- Labels y valores en tinta de texto, no en el color de la serie.
- Toda vista de gráfico tiene una **vista de tabla** equivalente accesible.

### 6.4 Lo "divertido" — dónde ponerlo

La personalidad va en el movimiento y el microcopy, no en saturar la pantalla:

- **Feedback háptico** (`navigator.vibrate`) al registrar el día
- **Spring animation** al seleccionar la cara: escala + rebote suave
- **Caras animadas**: la cara seleccionada se anima levemente en loop
- **Microcopy con voz propia**: *"Día registrado ✌️"* — nunca condescendiente ni
  motivacional forzado. Si alguien registra 😖 tres días seguidos, la app no dice
  "¡vos podés!"; dice algo neutro y respetuoso, o no dice nada.
- **Transiciones de página** con dirección coherente (tabs deslizan lateral, detalles
  suben)

Todas las animaciones respetan `prefers-reduced-motion`.

#### Decidido: sin rachas, sin gamificación

**No hay rachas, ni confeti, ni "llevás 7 días seguidos".** Una racha castiga
exactamente las semanas en que alguien deja de registrar, que suelen ser las malas —
y en una app de humor eso es contraproducente: convierte un mal mes en dos fracasos
en vez de uno. Además crea un incentivo para registrar por no romper la racha, lo que
ensucia justo los datos que la app existe para cuidar.

En su lugar, todo lo que cuenta días es **acumulativo y no se puede perder**:

- "**26 días registrados este mes**" · "**184 en total**"
- El indicador del mes (§5.2) usa esa cobertura como contexto del promedio, no como
  meta a cumplir.
- Sin barras de progreso hacia un objetivo, sin badges, sin notificaciones que
  reclamen. El recordatorio diario (opcional) invita; no insiste ni acumula deuda.

Un día sin registrar no es un error: es simplemente un día sin registrar.

### 6.5 Accesibilidad

Targets táctiles ≥ 44px · contraste AA en texto · labels ARIA en las caras (no solo
emoji) · navegable por teclado · el emoji nunca es el único portador de significado.

---

## 7. Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Build | **Vite** | Dev server instantáneo, PWA plugin maduro |
| UI | **React + TypeScript** | TS no es opcional acá: el modelo de fechas es donde se cometen los bugs |
| Estilos | **Tailwind CSS** | Velocidad de iteración, tokens de diseño consistentes |
| Componentes | **shadcn/ui** | Accesibles (Radix), copiás el código, no hay lock-in |
| Animación | **Framer Motion** | Springs y gestos, que es exactamente lo "divertido" |
| Storage | **Dexie** (IndexedDB) | API decente sobre IndexedDB, con migraciones |
| Estado servidor/DB | **Dexie live queries** o **TanStack Query** | Reactividad sobre la DB local |
| Estado UI | **Zustand** | Poco estado global real; Redux sería sobreingeniería |
| Fechas | **date-fns** | Modular, sin mutación, buen soporte de locale |
| Charts | **Recharts** (o **visx** si se necesita control fino) | Recharts alcanza para lo del v1 |
| PWA | **vite-plugin-pwa** | Service worker + manifest + prompt de instalación |
| Tests | **Vitest** + **Testing Library** | Los cálculos de ciclo y de agregación necesitan tests unitarios sí o sí |

> **Sobre versiones:** no se fijan en este documento. Se eligen al instalar, tomando
> siempre la última versión publicada hace **≥ 7 días** (higiene de supply chain).
> pnpm hace cumplir esa regla automáticamente vía `minimumReleaseAge` — ver
> [CONVENTIONS.md §3](CONVENTIONS.md), que cubre gestor de paquetes, instalación
> segura de dependencias, manejo de datos de prueba y reglas de código.

### Durabilidad del almacenamiento (esto no es opcional)

IndexedDB es la **única copia** de datos irreemplazables, y los navegadores lo pueden
desalojar. Tres mitigaciones concretas, todas en la fase 6:

1. **`navigator.storage.persist()`** — pedir almacenamiento persistente apenas el
   usuario registra su segundo día (no en el primer arranque, donde el permiso se
   niega por reflejo). Chequear con `navigator.storage.persisted()` y mostrarlo en
   Ajustes.
2. **iOS Safari desaloja el storage de sitios no instalados tras ~7 días de
   inactividad.** Para iOS, "instalá la app en tu pantalla de inicio" no es una
   sugerencia de UX: es un **requisito de integridad de datos**. El prompt de
   instalación en iOS tiene que decir eso, no "para una mejor experiencia".
3. **Recordatorio de backup** — si pasaron > 30 días desde el último export, un aviso
   discreto en Ajustes. Un backup que nadie hace no es un backup.

### ¿Por qué no Next.js?

No hay servidor, no hay SEO, no hay SSR que aporte nada. Vite + React da una SPA
offline-first más liviana y con menos ceremonia. Si algún día hay landing pública,
esa es otra app.

### Estructura propuesta

```
src/
  app/            # router, providers, shell, tab bar
  db/             # esquema Dexie, migraciones, repos
  domain/         # lógica pura y testeable — CERO React
    mood.ts       # agregados, cobertura, distribuciones
    cycle.ts      # detección de períodos, predicción, fases
    dates.ts      # DateKey, conversiones locales
  features/
    today/  calendar/  browse/  insights/  cycle/  settings/
  components/     # UI compartida (MoodFace, MoodScale, DayCell, StatTile…)
  design/         # tokens de color, escala de humor, tema
```

`domain/` sin React es deliberado: la detección de períodos y el cálculo de fases son
donde van a estar los bugs, y ahí es donde se pueden testear sin montar componentes.

---

## 8. Roadmap

| Fase | Entregable | Alcance |
|---|---|---|
| **0** | Base | Scaffold Vite+React+TS, Tailwind, tema claro/oscuro. Los tokens de humor **ya están validados** (§6.2) — solo hay que cablearlos en los dos scopes |
| **1** | Datos | Esquema Dexie, `domain/dates.ts` (`DateKey`), repos de mood, tests |
| **2** | Registrar | Pantalla Hoy, escala de humor animada, tags, nota, completar días pasados |
| **3** | Ver | **Indicador del mes** (cara + promedio + delta + cobertura), calendario heatmap, detalle del día en bottom sheet |
| **4** | Explorar | Días por humor con chips de filtro, lista, estados vacíos |
| **5** | Entender ✅ | Insights: tendencia (línea, con vista de tabla accesible), distribución, humor por tag, energía, síntomas, día de la semana |
| **6** | PWA | Manifest, service worker, offline, prompt de instalación, recordatorio local, **`storage.persist()` + el caso de desalojo en iOS** (§7) |
| **7** | Backup | Export/import JSON con **semántica de fusión explícita** (§5.6), aviso de backup vencido, borrado total |
| **8** | Ciclo | Registro de flujo y síntomas, **detección de períodos con ausente ≠ `none`** y filtro de plausibilidad (§4), predicción, overlay en calendario |
| **9** | Cruce | ✅ Humor por fase del ciclo (con duración real por ciclo, no solo la mediana global — `phaseForDate`). Pendiente: resumen mensual compartible |

Fases 0–7 = app de humor completa y usable. 8–9 = la capa de ciclo.

---

## 9. Decisiones cerradas y preguntas abiertas

### Cerradas

| Decisión | Resuelto | Nota |
|---|---|---|
| Escala de humor | **5 niveles** | Se prueba en uso; si molesta, se revisa. Migrar a slider después es barato (5 → 1-100 es multiplicar); al revés hay que bucketear |
| Registros por día | **Uno por día** | Confirma el `DateKey` como PK (§4) |
| Gamificación | **Sin rachas ni confeti** | Todo lo que cuenta días es acumulativo (§6.4) |
| Energía | **Sí, desde el v1, opcional** | Implementada como magnitud ordinal de un solo hue (⚡ que se llena), nunca los 5 hues del humor — ver `EnergyScale` en §6.2 |
| Tracking de ciclo | **Activado por defecto** | Con "Flujo" reducido a un chip on/off + síntomas inline (§5.1), registrar un día cuesta lo mismo que un tag — activarlo por defecto ya no impone fricción a quien no lo usa |
| Registro de período | **Un chip binario, inline, sin sheet** | Reemplaza el selector de 5 niveles de flujo detrás de un botón. El dato interno (`CycleDay.flow`) no cambió; solo la UI dejó de exponer la granularidad |
| Tags por defecto | **Se sacaron "Dinero" y "Salud"** | No calzaban con el resto de la lista para un tracker de humor; se agregaron "Pareja" y "Clima" en su lugar (§4) |
| Recordatorio diario | **Sí, uno solo, ~11:00 Argentina** | Sin condicional a la noche — rompía la idea de invitar sin insistir (§6.4). Requiere la primera pieza de infra fuera del dispositivo (Vercel + Web Push): plan completo en `NOTIFICATIONS.md` |

### Abiertas

1. **¿Nombre y tono?** "Celimood" — ¿es el nombre definitivo? ¿El tono es en "vos"
   (rioplatense) o neutro? Afecta todo el microcopy.
2. **¿Español solamente o i18n desde el arranque?** Meter i18n después cuesta;
   meterlo al principio cuesta poco. Recomiendo estructurar los strings aunque solo
   haya español.
3. **¿Bloqueo con PIN / biométrico?** Los datos de ciclo son sensibles y el
   dispositivo puede estar compartido. Es barato de agregar y aporta mucha confianza.
4. **¿Historial previo?** ¿Hay datos en otra app que quieras importar, o arrancamos de
   cero? Si hay que importar, el formato condiciona el importer.
5. **¿Quién lo usa?** ¿Es para vos, o pensás compartirla? Si es solo para vos, se puede
   simplificar bastante (menos onboarding, menos configuración).
