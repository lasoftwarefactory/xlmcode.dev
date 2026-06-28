# xlmcode — Brief de construcción del MVP

> **Qué es este documento:** la especificación completa que vas a usar (Claude Code) para construir el MVP de **xlmcode** de principio a fin. Está pensado para que arranques a programar sin tener que adivinar arquitectura. Leelo entero antes de escribir código. Donde diga `TODO / VERIFICAR`, no inventes datos: dejá un placeholder y avisá.

---

## 0. Resumen ejecutivo (leé esto primero)

**xlmcode es un "Lovable/v0 pero para Stellar".** El usuario describe una dApp en lenguaje natural y la plataforma:

1. Genera el **frontend** (React + Vite + Tailwind) con un agente de IA y lo muestra en un **preview en vivo dentro del navegador** (Sandpack).
2. Le permite **desplegar contratos inteligentes auditados** en la testnet de Stellar (sin escribir Rust) y/o **invocar protocolos ya desplegados** del ecosistema.
3. **Conecta el frontend generado con esos contratos** automáticamente.

El diferencial frente a Lovable/v0 (que solo hacen web apps comunes) y frente a StellarIDE (que es un IDE para devs que escriben Rust) es que **xlmcode junta el preview-de-frontend de Lovable con una capa on-chain de Stellar, para gente que no programa.**

**Decisión arquitectónica central (no la cambies):** los contratos NO se compilan en el navegador ni "en vivo". Usamos **WASM pre-compilados** que el usuario solo **configura** (parámetros), y el backend los **despliega**. Los protocolos externos (oráculos, DEX) no se despliegan: se **invocan** por su contract ID ya existente. Esto se llama "Camino B" en las notas de diseño y es lo que hace el MVP construible en pocos días.

---

## 1. Conceptos que tenés que tener clarísimos antes de empezar

### 1.1. Hay DOS aplicaciones React, no una

Esto es la fuente de confusión #1. Separalas mentalmente:

- **La plataforma xlmcode** (`apps/web`): la app que construís vos. Tiene el chat, el panel de preview, las pestañas (Preview / Código / Contrato), el botón de deploy. Es una app Vite + Tailwind normal.
- **La app del usuario** (la "app generada"): NO es un proyecto en disco. Es un **árbol de archivos en memoria** (`{ "src/App.tsx": "...", ... }`) que vive en el estado de la plataforma y se renderiza dentro de **Sandpack** (un iframe). El usuario nunca "instala" nada; su app corre client-side en el preview.

> Regla mental: la plataforma es el editor; la app del usuario es el documento que se edita. Sandpack es el visor del documento.

### 1.2. Hay DOS tipos de contratos

| Tipo                    | Qué es                                                         | Qué hace la plataforma                                                                                        | Ejemplos                              |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Deployable (Tipo 1)** | Plantilla auditada; cada usuario quiere SU instancia           | Toma un WASM pre-compilado + config → **despliega** una instancia nueva en testnet → devuelve un `contractId` | OZ Fungible Token, OZ Ownable, OZ NFT |
| **Deployed (Tipo 2)**   | Protocolo que ya vive en la red; todos usan la misma instancia | **Invoca** un `contractId` fijo existente (no despliega nada)                                                 | Reflector (oráculo), Soroswap (DEX)   |

El sistema debe tratar a los dos con el mismo "manifiesto" (ver §6) pero con flujos distintos: Tipo 1 → deploy; Tipo 2 → invoke.

### 1.3. El LLM no tiene memoria — la memoria la maneja la plataforma

El agente de IA es **sin estado**. En cada turno, la plataforma le manda:

- El árbol de archivos actual de la app del usuario.
- El catálogo de contratos disponibles.
- El historial de la conversación.
- El pedido nuevo del usuario.

El LLM responde con **operaciones** (crear/editar/borrar archivos, desplegar/invocar contratos), y la plataforma las **aplica** a su estado. El LLM propone; la plataforma es la fuente de la verdad.

---

## 2. Stack técnico (fijo)

- **Frontend de la plataforma:** Vite + React + TypeScript + TailwindCSS.
- **Preview de la app del usuario:** Sandpack (`@codesandbox/sandpack-react`).
- **Backend:** Express, empaquetado como **funciones serverless de Vercel** (carpeta `/api`). Ver §4 para el formato exacto que espera Vercel.
- **Base de datos / persistencia:** Supabase (Postgres + Storage + Auth opcional).
- **Blockchain:** Stellar testnet vía `@stellar/stellar-sdk` (cliente) y `stellar-cli` / SDK en el backend para deploy.
- **Wallet:** Stellar Wallets Kit (conectar Freighter/xBull/Lobstr) + passkeys/smart wallets como objetivo de UX (ver §8).
- **LLM:** API de Claude/OpenAI/Gemini vía **BYOK** (el usuario trae su propia API key). Ver §7 para seguridad.
- **Deploy:** Vercel (frontend estático + funciones serverless en `/api`).

> **Importante sobre Vercel + compilación de contratos:** las funciones serverless de Vercel NO pueden compilar Rust ni correr `stellar-cli` pesado dentro del runtime serverless de forma confiable. Por eso el MVP usa **WASM ya pre-compilados** (commiteados en el repo) y el deploy se hace con el **SDK de JS** (`@stellar/stellar-sdk`), que sí corre en serverless, en lugar de invocar el binario de Rust. Si el deploy vía SDK puro diera problemas, ver §9.4 (plan B: microservicio de deploy aparte). NO intentes compilar Rust en Vercel.

---

## 3. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                     NAVEGADOR DEL USUARIO                      │
│                                                               │
│  ┌─────────────┐   ┌──────────────────────────────────────┐  │
│  │   CHAT       │   │   PANEL DERECHO (tabs)                │  │
│  │  (prompts)   │   │   • Preview (Sandpack iframe)         │  │
│  │              │   │   • Código (file tree + editor)       │  │
│  │              │   │   • Contrato (contractId, tx, explorer)│ │
│  └──────┬───────┘   └──────────────────────────────────────┘  │
│         │ fileTree (estado React) = FUENTE DE LA VERDAD        │
└─────────┼─────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────────────────┐
│            BACKEND (Express → funciones serverless Vercel)    │
│                                                               │
│  POST /api/chat      → proxy al LLM (BYOK en memoria)         │
│  POST /api/deploy    → despliega WASM Tipo 1 en testnet       │
│  POST /api/invoke    → (opcional) invoca contrato Tipo 2      │
│  GET/POST /api/projects → CRUD de proyectos (Supabase)        │
│  GET /api/contracts  → devuelve el catálogo (manifiestos)     │
└──────┬───────────────────────────┬────────────────────────────┘
       │                           │
       ▼                           ▼
┌──────────────┐          ┌───────────────────────┐
│   SUPABASE    │          │   STELLAR TESTNET      │
│  projects     │          │  (RPC + Horizon)       │
│  deployments  │          │  WASM pre-compilados   │
└──────────────┘          └───────────────────────┘
```

### 3.1. El flujo de un prompt, paso a paso

1. Usuario escribe: _"Creame un token llamado PEÑA con 10.000 unidades y una página que muestre su supply"_.
2. `apps/web` arma el payload `{ projectId, fileTree, history, userMessage }` y hace `POST /api/chat`.
3. `/api/chat` construye el **system prompt** (reglas + árbol de archivos + catálogo de contratos), agrega el mensaje del usuario, y llama al LLM con la **API key del usuario** (tomada de la sesión en memoria, nunca persistida).
4. El LLM responde con un **JSON estructurado** (ver §5.3): operaciones de archivos + operaciones de contrato + un mensaje para el chat.
5. El backend valida el JSON y lo devuelve a `apps/web`.
6. `apps/web` **aplica las operaciones de archivos** a su `fileTree` (crear/editar/borrar) → Sandpack re-renderiza el preview.
7. Si hay una operación de contrato `deploy`, `apps/web` llama a `POST /api/deploy` con `{ manifestId, config }`. El backend despliega el WASM en testnet y devuelve `{ contractId, txHash }`.
8. El backend/plataforma **inyecta el `contractId`** en un archivo de la app generada (ej. `src/contracts.ts`) para que el front sepa con qué contrato hablar.
9. `apps/web` persiste el `fileTree` actualizado en Supabase (`projects.files`) y guarda el deployment en `deployments`.
10. La pestaña "Contrato" muestra el `contractId` + link a Stellar Expert testnet.

---

## 4. Backend en Express sobre Vercel (formato exacto)

Vercel espera las funciones serverless en una carpeta `/api` en la raíz. Hay dos formas; usá **la de funciones individuales** (más simple y la que Vercel documenta), pero con un router Express compartido para no repetir código.

### 4.1. Estructura de carpetas

```
xlmcode/
├── api/                      # funciones serverless de Vercel (cada archivo = endpoint)
│   ├── chat.ts               # POST /api/chat
│   ├── deploy.ts             # POST /api/deploy
│   ├── invoke.ts             # POST /api/invoke
│   ├── projects.ts           # GET/POST /api/projects
│   ├── contracts.ts          # GET /api/contracts
│   └── _lib/                 # código compartido (NO es endpoint; prefijo _ lo excluye)
│       ├── llm.ts            # cliente LLM (Claude/OpenAI/Gemini)
│       ├── stellar.ts        # deploy/invoke con @stellar/stellar-sdk
│       ├── supabase.ts       # cliente Supabase (service role)
│       ├── session.ts        # manejo de API key en memoria
│       └── prompt.ts         # construcción del system prompt
├── contracts/                # WASM pre-compilados + manifiestos
│   ├── manifests/
│   │   ├── oz-fungible-token.json
│   │   ├── oz-ownable.json
│   │   ├── oz-nft.json
│   │   ├── reflector.json
│   │   └── soroswap.json
│   └── wasm/
│       ├── oz_fungible_token.wasm
│       ├── oz_ownable.wasm
│       └── oz_nft.wasm
├── src/                      # frontend de la plataforma (Vite + React + Tailwind)
│   ├── components/
│   ├── lib/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── vercel.json
└── .env.local
```

### 4.2. Cómo escribir un handler serverless (firma que espera Vercel)

Cada archivo en `/api` exporta un handler por defecto con la firma de Vercel:

```ts
// api/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildSystemPrompt } from './_lib/prompt'
import { callLLM } from './_lib/llm'
import { getSessionKey } from './_lib/session'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { projectId, fileTree, history, userMessage, sessionId, provider } =
      req.body

    // La API key del usuario vive en memoria de sesión, NUNCA en el body persistido ni en DB.
    const apiKey = getSessionKey(sessionId, provider)
    if (!apiKey) return res.status(401).json({ error: 'No API key in session' })

    const systemPrompt = buildSystemPrompt({
      fileTree,
      catalog: await loadCatalog(),
    })
    const llmResponse = await callLLM({
      provider,
      apiKey,
      systemPrompt,
      history,
      userMessage,
    })

    // llmResponse ya viene parseado y validado como AgentResponse (ver §5.3)
    return res.status(200).json(llmResponse)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
```

### 4.3. `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/**/*.ts": { "maxDuration": 60 }
  }
}
```

> `maxDuration: 60` porque las llamadas al LLM y el deploy pueden tardar. Si usás el plan gratuito de Vercel, el límite puede ser menor (10s en Hobby para algunas configs) — `VERIFICAR` el límite del plan y, si hace falta, mover el deploy a streaming o a un microservicio (ver §9.4).

### 4.4. Endpoints (contrato de la API)

```
POST /api/chat
  body: { sessionId, provider, projectId, fileTree, history, userMessage }
  resp: AgentResponse  (ver §5.3)

POST /api/deploy
  body: { manifestId, config, network: "testnet" }
  resp: { contractId, txHash, explorerUrl }

POST /api/invoke        (opcional para MVP; muchas invocaciones pueden ir client-side)
  body: { contractId, method, args, network }
  resp: { result, txHash? }

GET  /api/contracts
  resp: Manifest[]      (el catálogo completo)

GET  /api/projects?userId=...
  resp: Project[]
POST /api/projects
  body: { id?, userId, name, files }
  resp: Project
```

---

## 5. El agente de IA: cómo genera y edita archivos

Esta es la pieza más importante y la que más te conviene clavar bien desde el principio.

### 5.1. La fuente de la verdad: el `fileTree`

```ts
type FileTree = Record<string, string> // { "src/App.tsx": "<contenido>", ... }
```

Vive en el estado de React de `apps/web` (y se persiste en Supabase). El LLM nunca lo modifica directamente: propone operaciones que la plataforma aplica.

### 5.2. El system prompt que le mandás al LLM

`_lib/prompt.ts` debe construir algo así (en español o inglés, pero consistente):

````
Sos el motor de generación de xlmcode. Generás y editás una aplicación
React + Vite + TailwindCSS que corre dentro de Sandpack, y que puede
interactuar con contratos inteligentes de Stellar.

REGLAS DURAS:
- Respondés SIEMPRE y SOLO con un objeto JSON válido que cumple el schema AgentResponse.
  Nada de texto fuera del JSON. Nada de markdown. Nada de ```.
- El frontend usa React 18, Vite, TailwindCSS (clases utilitarias) y el
  Stellar SDK ya disponible como dependencia.
- Para hablar con contratos, importá la config desde "./contracts" (archivo
  src/contracts.ts que la plataforma mantiene con los contractId reales).
- No uses localStorage ni APIs del navegador no soportadas por Sandpack.
- Mantené los componentes simples y autocontenidos.

ESTADO ACTUAL DEL PROYECTO (archivos):
<acá se inyecta el fileTree completo, archivo por archivo>

CONTRATOS DISPONIBLES (catálogo):
<acá se inyecta el catálogo: id, nombre, tipo, config requerida, métodos>

Cuando el usuario pida algo que necesite un contrato:
- Si es Tipo "deployable", emití una operación contract { op: "deploy", manifestId, config }.
- Si es Tipo "deployed", emití { op: "invoke", contractId, method, args } o generá
  el código que lo invoca usando el contractId del catálogo.
- Después de un deploy, la plataforma te dará el contractId y lo pondrá en src/contracts.ts.
````

> Optimización de contexto: para el MVP, **mandá el `fileTree` completo siempre**. No implementes selección de archivos relevantes ni embeddings. Eso es post-MVP. Con proyectos chicos el costo es aceptable.

### 5.3. El schema de respuesta del agente (`AgentResponse`)

El LLM debe devolver exactamente esto. Validalo en el backend (con zod) antes de devolverlo al front.

```ts
type FileOp =
  | { op: 'create'; path: string; content: string }
  | { op: 'edit'; path: string; content: string } // reemplaza el archivo entero
  | { op: 'delete'; path: string }

type ContractOp =
  | {
      op: 'deploy'
      manifestId: string
      config: Record<string, unknown>
      bindTo?: string
    }
  | { op: 'invoke'; contractId: string; method: string; args: unknown[] }

interface AgentResponse {
  message: string // texto para mostrar en el chat ("Listo, creé tu token y la página...")
  files: FileOp[] // operaciones de archivo a aplicar
  contracts: ContractOp[] // operaciones de contrato (puede ir vacío)
}
```

> **Por qué `edit` reemplaza el archivo entero y no hace diffs:** los diffs por línea son frágiles y caros de implementar bien. Para el MVP, reemplazo de archivo completo. Es más tokens pero infinitamente más confiable. Optimización post-MVP.

### 5.4. Aplicar las operaciones en el frontend

```ts
function applyFileOps(tree: FileTree, ops: FileOp[]): FileTree {
  const next = { ...tree }
  for (const op of ops) {
    if (op.op === 'create' || op.op === 'edit') next[op.path] = op.content
    if (op.op === 'delete') delete next[op.path]
  }
  return next
}
```

Después de aplicar, actualizás el estado → Sandpack recibe el nuevo `files` → re-render automático.

---

## 6. Catálogo de contratos: el "manifiesto"

En vez de hardcodear cada contrato, definí un **formato de manifiesto** (un JSON por contrato). Agregar un contrato nuevo = escribir un manifiesto, sin tocar el motor. Esto es clave para el pitch ("nuestro sistema es extensible: cada protocolo de Stellar es un manifiesto").

### 6.1. Schema del manifiesto

```ts
interface Manifest {
  id: string // "oz-fungible-token"
  name: string // "Fungible Token"
  description: string
  type: 'deployable' | 'deployed' // Tipo 1 o Tipo 2
  category: 'token' | 'access' | 'nft' | 'oracle' | 'dex' | string

  // Solo para deployable (Tipo 1):
  wasmPath?: string // "contracts/wasm/oz_fungible_token.wasm"
  init?: { method: string; argsFromConfig: string[] }

  // Solo para deployed (Tipo 2):
  contractId?: string | null // dirección fija en testnet (TODO VERIFICAR)
  network?: 'testnet' | 'mainnet'

  // Config que pide al usuario (genera UI de formulario sola):
  config: Array<{
    key: string
    label: string
    type: 'string' | 'number' | 'address'
    default?: unknown
  }>

  // Métodos que expone (para que el LLM sepa cómo invocarlo):
  methods: Array<{
    name: string
    args: string[]
    returns: string
    mutates: boolean
  }>
}
```

### 6.2. Ejemplo: `oz-fungible-token.json`

```json
{
  "id": "oz-fungible-token",
  "name": "Fungible Token",
  "description": "Token estándar configurable (nombre, símbolo, supply inicial).",
  "type": "deployable",
  "category": "token",
  "wasmPath": "contracts/wasm/oz_fungible_token.wasm",
  "init": {
    "method": "__constructor",
    "argsFromConfig": ["owner", "name", "symbol", "initial_supply"]
  },
  "config": [
    {
      "key": "name",
      "label": "Nombre del token",
      "type": "string",
      "default": "MiToken"
    },
    { "key": "symbol", "label": "Símbolo", "type": "string", "default": "MTK" },
    {
      "key": "initial_supply",
      "label": "Supply inicial",
      "type": "number",
      "default": 1000000
    }
  ],
  "methods": [
    {
      "name": "balance",
      "args": ["address"],
      "returns": "i128",
      "mutates": false
    },
    {
      "name": "transfer",
      "args": ["from", "to", "amount"],
      "returns": "void",
      "mutates": true
    },
    { "name": "total_supply", "args": [], "returns": "i128", "mutates": false }
  ]
}
```

### 6.3. Ejemplo: `reflector.json` (Tipo 2)

```json
{
  "id": "reflector",
  "name": "Reflector (oráculo de precios)",
  "description": "Lee precios on-chain (SEP-40). Ya desplegado en la red.",
  "type": "deployed",
  "category": "oracle",
  "contractId": "TODO_VERIFICAR_CONTRACT_ID_TESTNET",
  "network": "testnet",
  "config": [],
  "methods": [
    {
      "name": "lastprice",
      "args": ["asset"],
      "returns": "PriceData",
      "mutates": false
    }
  ]
}
```

> `TODO / VERIFICAR`: los contractId de Reflector y Soroswap en **testnet** hay que confirmarlos en su documentación antes de usarlos. No inventes direcciones. Si solo existieran en mainnet, marcá el manifiesto como `network: "mainnet"` y avisá, porque el MVP debe correr en testnet.

---

## 7. Seguridad: BYOK (la API key del usuario)

El usuario conecta su propia API key del LLM para no gastar tu plata. Reglas innegociables:

1. **La API key viaja del navegador a tu backend por HTTPS y se guarda SOLO en memoria de sesión del servidor.** Nunca en Supabase, nunca en un archivo, nunca en el `fileTree`, nunca en el frontend de otros usuarios.
2. **Todas las llamadas al LLM pasan por tu backend como proxy.** El navegador nunca habla directo con la API del LLM (eso expondría la key).
3. **No la persistas.** Modelo recomendado para el MVP: la key se manda al iniciar sesión, se guarda en un `Map` en memoria keyed por `sessionId`, y se descarta. Si el serverless se reinicia, el usuario la vuelve a pegar. **Si no la guardás en disco, no hay nada que robar** — y es lo más fácil de defender ante un jurado que pregunte por seguridad.

```ts
// _lib/session.ts  (memoria efímera; aceptable para MVP)
const keys = new Map<string, { provider: string; apiKey: string; ts: number }>()
export function setSessionKey(
  sessionId: string,
  provider: string,
  apiKey: string,
) {
  keys.set(`${sessionId}:${provider}`, { provider, apiKey, ts: Date.now() })
}
export function getSessionKey(sessionId: string, provider: string) {
  return keys.get(`${sessionId}:${provider}`)?.apiKey ?? null
}
```

> Nota serverless: la memoria no es compartida entre instancias de Vercel. Para el MVP (demo, pocos usuarios) es aceptable. Si hiciera falta persistencia entre instancias, usar un store encriptado (Supabase Vault / KMS) — pero NO para el MVP.

> **Fuera de alcance (NO construir):** conectar Claude Code/Codex local del usuario (estilo opencode). Requiere una app desktop con acceso al sistema de archivos local y NO se puede hacer desde el navegador. Va en el deck como "visión futura", no en el código.

---

## 8. Wallet

Dos cosas distintas:

1. **Conectar una wallet existente:** usá **Stellar Wallets Kit** (`@creit.tech/stellar-wallets-kit`), que integra Freighter, xBull, Lobstr, etc. Botón "Conectar wallet" estándar, client-side.
2. **Crear wallets desde el navegador sin extensión:** objetivo de UX no-cripto. Para el MVP, lo más rápido que funciona es generar keypairs de testnet en memoria y fondearlas con **Friendbot** (`https://friendbot.stellar.org/?addr=<G...>`). Las **passkeys / smart wallets** (WebAuthn) son el camino "real" y quedan como mejora si sobra tiempo, no como bloqueante.

> Para el demo: que el usuario pueda conectar Freighter en testnet O usar una wallet efímera fondeada por Friendbot. Con eso alcanza para firmar transacciones del preview.

---

## 9. Despliegue de contratos (el backend de Stellar)

### 9.1. Tipo 1 (deployable) — `POST /api/deploy`

Flujo dentro de `_lib/stellar.ts`:

1. Cargar el manifiesto por `manifestId` y leer su `wasmPath`.
2. Tener una **identidad de testnet del backend** (clave en env var `STELLAR_DEPLOYER_SECRET`) que paga el deploy. Fondearla con Friendbot una vez (script de setup).
3. Subir el WASM (`uploadContractWasm`) → obtener el `wasmHash`.
4. Crear la instancia (`createCustomContract` / `deploy`) → obtener el `contractId`.
5. Llamar al método de init (`__constructor`) con los args armados desde `config`.
6. Devolver `{ contractId, txHash, explorerUrl: "https://stellar.expert/explorer/testnet/contract/<id>" }`.

Usá `@stellar/stellar-sdk` (server-side). Pseudo:

```ts
import {
  rpc,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk'

export async function deployContract(
  manifest: Manifest,
  config: Record<string, unknown>,
) {
  const server = new rpc.Server(process.env.STELLAR_RPC_URL!) // testnet RPC
  const deployer = Keypair.fromSecret(process.env.STELLAR_DEPLOYER_SECRET!)
  const wasm = await fs.readFile(path.join(process.cwd(), manifest.wasmPath!))
  // 1) upload wasm  2) deploy instance  3) invoke __constructor con config
  // ... (usar las helpers del SDK: uploadContractWasm / deploy / invoke)
  return { contractId, txHash, explorerUrl }
}
```

### 9.2. Tipo 2 (deployed) — invocación

No despliega. El front (o `/api/invoke`) usa el `contractId` del manifiesto y arma una llamada de lectura/escritura con el SDK. Las **lecturas** (ej. precio de Reflector) pueden hacerse client-side sin firmar; las **escrituras** (ej. swap en Soroswap) requieren firma de wallet.

### 9.3. Inyección del `contractId` en la app del usuario

Después de un deploy, la plataforma escribe/actualiza `src/contracts.ts` en el `fileTree`:

```ts
// src/contracts.ts (mantenido por la plataforma, no por el LLM)
export const CONTRACTS = {
  myToken: { id: 'C...ABC', network: 'testnet' },
  reflector: { id: 'C...REF', network: 'testnet' },
}
```

El LLM importa de acá. Así el front generado siempre tiene los IDs reales.

### 9.4. Plan B si el deploy no entra en serverless

Si compilar/desplegar vía SDK en Vercel da problemas de timeout o tamaño:

- Mover SOLO el deploy a un microservicio chico (Railway/Render/Fly) con `stellar-cli` instalado, y que Vercel le pegue por HTTP.
- O pre-desplegar instancias "demo" y, para el MVP, simular el deploy devolviendo un contractId pre-armado (transparentando en el deck que el deploy real es post-MVP). **Preferí siempre el deploy real si entra.**

---

## 10. Supabase

### 10.1. Esquema

```sql
-- proyectos (cada app generada)
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                       -- opcional para MVP (puede ser null/anon)
  name text not null default 'Untitled',
  files jsonb not null default '{}',  -- el fileTree serializado
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- despliegues (contratos desplegados por proyecto)
create table deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  manifest_id text not null,
  contract_id text not null,
  network text not null default 'testnet',
  config jsonb,
  tx_hash text,
  created_at timestamptz default now()
);
```

### 10.2. Uso

- `_lib/supabase.ts` crea el cliente con la **service role key** (solo en backend, nunca en el front).
- El front guarda el `fileTree` en `projects.files` (debounce de ~1s para no escribir en cada tecla).
- Auth es **opcional para el MVP**: podés permitir uso anónimo (un `projectId` en la URL). Si agregás Supabase Auth (magic link), mejor, pero no es bloqueante.

> Para el MVP, el código de la app del usuario NO necesita salir del navegador para que el preview funcione (Sandpack es local). Supabase es solo para **persistir y recuperar** la sesión. No lo metas en el camino crítico del render.

---

## 11. Frontend de la plataforma (`src/`)

### 11.1. Layout

- **Izquierda:** panel de chat (lista de mensajes + input). Cada mensaje del agente muestra su `message`; las operaciones se aplican silenciosamente al estado.
- **Derecha:** tabs.
  - **Preview:** `<Sandpack>` con `files = fileTree` y template `vite-react-ts`.
  - **Código:** árbol de archivos navegable + editor read-only (o editable, opcional).
  - **Contrato:** lista de deployments del proyecto (contractId, red, txHash, link a Stellar Expert).
- **Top bar:** nombre del proyecto, botón "Conectar wallet", selector de provider LLM + input de API key (BYOK), botón "Deploy".

### 11.2. Sandpack

```tsx
import { Sandpack } from '@codesandbox/sandpack-react'

;<Sandpack
  template="vite-react-ts"
  files={fileTree} // { "src/App.tsx": "...", ... }
  customSetup={{
    dependencies: {
      '@stellar/stellar-sdk': 'latest',
      '@creit.tech/stellar-wallets-kit': 'latest',
    },
  }}
  options={{ showTabs: true, editorHeight: 600 }}
/>
```

> Sandpack bundlea en el navegador (esbuild-wasm) → preview en vivo, sin server, sin latencia. El stack siempre es Vite+React+TS+Tailwind para la app generada. `VERIFICAR`: que las clases de Tailwind funcionen en Sandpack (puede requerir incluir el CDN de Tailwind o configurar PostCSS dentro de los archivos generados; lo más simple para el MVP es inyectar el script CDN de Tailwind en el `index.html` de la app generada).

### 11.3. TailwindCSS

- En la **plataforma**: Tailwind normal (config + PostCSS + Vite plugin).
- En la **app generada dentro de Sandpack**: la forma más robusta y rápida para el MVP es inyectar Tailwind por CDN en el `index.html` del template generado, para no pelear con PostCSS dentro de Sandpack. (Optimización post-MVP: build real de Tailwind en el sandbox.)

---

## 12. Los 5 contratos del MVP

Construilos en este orden. Los 3 primeros comparten el mismo patrón de deploy (lo hacés una vez, lo reusás). Los 2 últimos son invocación de contratos ya desplegados.

1. **OZ Fungible Token** (deployable) — el "hola mundo". Valida todo el pipeline: config → deploy → contractId → front habla con el contrato. **Hacelo andar de punta a punta antes de tocar cualquier otra cosa.**
2. **OZ Ownable** (deployable/módulo) — demuestra composición (poner dueño al token). Liviano.
3. **OZ NFT (con regalías)** (deployable) — segundo tipo de activo; mismo patrón de deploy; conecta con el ángulo arte/música.
4. **Reflector** (deployed/oráculo) — primera composición con el ecosistema vivo. Solo lectura → bajo riesgo, alto efecto.
5. **Soroswap** (deployed/DEX) — cierre de la historia: swap real. Requiere firma de wallet.

> `TODO / VERIFICAR` antes de comprometer 4 y 5: que Reflector y Soroswap tengan contractId públicos y usables en **testnet**. Si alguno no, reemplazarlo por un segundo módulo OZ (ej. Vault) y dejar el de mainnet para el roadmap.

---

## 13. Prompts de ejemplo que el MVP debe poder resolver

Usalos como casos de prueba de aceptación (de simple a compuesto):

1. _"Creame un token llamado PEÑA con 10.000 unidades."_ → deploy Fungible Token + página que muestra nombre/supply.
2. _"Una página que muestre el supply total de mi token en tiempo real."_ → lectura `total_supply`.
3. _"Una app para mandar tokens a una dirección."_ → `transfer` + firma de wallet.
4. _"Que solo yo pueda emitir más tokens."_ → Token + Ownable (composición de dos).
5. _"Una galería donde subo arte como NFT."_ → deploy NFT + grilla.
6. _"Que cada reventa de mi NFT me pague 10%."_ → NFT con regalías (mostrar el split).
7. _"Mostrame el precio de XLM en vivo."_ → invoca Reflector (lectura).
8. _"Mostrá el precio de mi token en dólares según el mercado."_ → Token + Reflector.
9. _"Un botón para cambiar mi token por USDC."_ → swap en Soroswap.
10. _"App completa: creo mi token, muestro su precio de mercado y permito intercambiarlo."_ → Token + Reflector + Soroswap. **Este es el demo de cierre.**

---

## 14. Orden de construcción (milestones)

> Filosofía: construí de afuera hacia adentro. **Lo que se ve en el demo es lo que importa.** Un loop mínimo andando vale más que diez features rotas.

### Milestone 0 — Andamiaje (primero de todo)

- Repo monorepo con la estructura de §4.1. Vite+React+Tailwind en `src/`. `/api` con un endpoint dummy. `vercel.json`. Deploy de prueba a Vercel funcionando (aunque sea "hello world").

### Milestone 1 — El loop de chat → preview (SIN contratos todavía)

- Chat UI + estado `fileTree`.
- `POST /api/chat` con BYOK en memoria → LLM → `AgentResponse` validado con zod.
- Aplicar `FileOp[]` al `fileTree` → renderizar en Sandpack.
- **Criterio de éxito:** escribo "una landing con un botón que dice hola" y aparece en el preview. Este es el corazón "Lovable". **No sigas hasta que esto ande.**

### Milestone 2 — Deploy de UN contrato (Fungible Token)

- Manifiesto + WASM de OZ Fungible Token commiteado.
- `POST /api/deploy` con el SDK → contractId real en testnet.
- Inyección de `src/contracts.ts` en el fileTree.
- Pestaña "Contrato" con link a Stellar Expert.
- **Criterio de éxito:** "creame un token PEÑA con 10.000" → token desplegado en testnet + página que lee su supply. Tx visible en el explorer.

### Milestone 3 — Composición y segundo/tercer contrato

- Ownable + NFT (mismo patrón de deploy).
- Prompt de composición (#4 y #6) andando.

### Milestone 4 — Ecosistema vivo (Reflector, luego Soroswap)

- Invocación de Reflector (lectura de precio) — si el testnet ID está confirmado.
- Swap en Soroswap con firma de wallet.
- **Criterio de éxito:** el prompt #10 (demo de cierre) corre de principio a fin.

### Milestone 5 — Persistencia + pulido

- Supabase: guardar/cargar proyectos y deployments.
- Wallet connect (Freighter testnet) o wallet efímera con Friendbot.
- Empaque para el video: que el flujo se vea limpio.

---

## 15. Qué NO construir para el MVP (guardarraíles)

No toques nada de esto hasta después de ganar:

- ❌ Compilación de Rust en el navegador o en Vercel.
- ❌ Contratos escritos libremente por el LLM (solo configurar templates pre-compilados).
- ❌ Optimización de contexto del LLM (mandá el fileTree completo).
- ❌ Diffs por línea (reemplazá archivos enteros).
- ❌ Claude Code/Codex local / app desktop.
- ❌ Encriptación elaborada de API keys (memoria efímera per-session alcanza).
- ❌ Auth obligatoria (anónimo está bien para el MVP).
- ❌ Más de 5 contratos (los demás van como "galería / próximamente" en la UI).
- ❌ Passkeys/smart wallets si comen tiempo (Friendbot + wallet efímera alcanza).

---

## 16. Variables de entorno

```
# LLM (BYOK: el usuario las trae; estas son fallback opcionales para dev)
# No commitear keys reales.

# Stellar
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_DEPLOYER_SECRET=S...        # cuenta de testnet del backend que paga deploys (fondear con Friendbot)

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...       # SOLO backend
VITE_SUPABASE_URL=...               # para el front (anon key si se usa auth)
VITE_SUPABASE_ANON_KEY=...
```

---

## 17. Criterios de "terminado" (Definition of Done del MVP)

El MVP está listo para el video/pitch cuando:

1. ✅ Escribo un prompt en lenguaje natural y aparece una app React en el preview de Sandpack, en vivo.
2. ✅ Puedo desplegar al menos un contrato (Fungible Token) en testnet desde un prompt, y veo su contractId + tx en Stellar Expert.
3. ✅ La app generada **interactúa de verdad** con el contrato desplegado (lee supply / transfiere).
4. ✅ Al menos un contrato Tipo 2 (Reflector o Soroswap) se invoca desde la app generada (composición con el ecosistema).
5. ✅ El proyecto se guarda y se puede recuperar (Supabase).
6. ✅ Todo corre desplegado en Vercel (frontend + `/api`).
7. ✅ El prompt #10 (demo de cierre) corre de principio a fin sin romperse.

> Si llegás a (1)+(2)+(3) ya tenés algo que gana. (4) en adelante es lo que lo vuelve imbatible.

---

## 18. Notas finales para el agente

- Trabajá **milestone por milestone**. No empieces el siguiente hasta que el criterio de éxito del actual esté verde.
- Cada vez que dudes entre "ambicioso pero frágil" y "simple pero sólido", elegí **simple y sólido**. Terminar > impresionar.
- Donde haya un `TODO / VERIFICAR`, no inventes datos (especialmente contractId de testnet). Dejá el placeholder, hacelo funcionar con un mock claramente marcado, y avisá qué falta confirmar.
- Mantené la distinción de las dos apps (plataforma vs. app del usuario) y los dos tipos de contrato (deployable vs. deployed) presente en todo el código. Casi todos los bugs conceptuales vienen de mezclar esas cuatro cosas.

```

```
