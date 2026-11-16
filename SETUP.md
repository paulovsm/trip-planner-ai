# Guia de configuração — TripPlanner

Como obter as chaves, configurar o banco e rodar o projeto localmente e na Vercel. Variáveis de ambiente: veja `.env.example`.

## 1. Pré-requisitos

- Node.js 22+ (`.nvmrc`)
- Um projeto no Google Cloud / Firebase
- Para os testes de integração: Java 21 (emulador do Firestore). No macOS: `brew install openjdk@21`.

## 2. Firestore

1. No [Firebase Console](https://console.firebase.google.com/), abra o projeto e vá em **Firestore Database**.
2. Crie o banco **nomeado** `tripplanner` (o `firebase.json` já aponta para ele). O app começou um esquema novo sem migração (ADR-0003); não reutilize o banco antigo. Pelo CLI (após `npx firebase login`):
   ```bash
   npx firebase firestore:databases:create tripplanner --location nam5 --delete-protection ENABLED --project <seu-project-id>
   ```
3. Em **Configurações do projeto → Contas de serviço → Gerar nova chave privada**, copie do JSON para o `.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - nome do banco → `FIRESTORE_DATABASE_ID`
4. Publique as regras (negam todo acesso direto; o app usa só o Admin SDK, ADR-0002), os índices e a política de TTL de `rateLimits`:
   ```bash
   npx firebase deploy --only firestore --project <seu-project-id>
   ```

## 3. Google Cloud

O Google Maps Platform exige **faturamento ativo** no projeto (Faturamento → vincular uma conta). O uso de uma pessoa e família fica dentro da cota gratuita mensal; se quiser, crie um alerta de orçamento em **Faturamento → Orçamentos e alertas**.

### APIs (APIs e serviços → Biblioteca)
| API | Usada por | Chave |
|---|---|---|
| **Maps JavaScript API** | mapa | navegador |
| **Places API (New)** | autocomplete ao adicionar lugar (navegador); importação e busca do assistente (servidor) | as duas |
| **Routes API** | Calcular percurso, Otimizar, GPX | servidor |
| **Generative Language API** (Gemini) | chat, assistente, importação | `GEMINI_API_KEY` (ou gere direto no [Google AI Studio](https://aistudio.google.com/)) |

### Chave do navegador — `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
1. **APIs e serviços → Credenciais → Criar credenciais → Chave de API.** Na chave criada, clique em **Editar chave de API**.
2. **Restrições de aplicativo → Sites (referenciadores HTTP)**: `http://localhost:3000/*` e `https://<seu-dominio>/*`.
3. **Restrições de API → Restringir chave**: Maps JavaScript API e Places API (New).
4. Salve e copie para o `.env`. Ela fica pública no bundle; as restrições são a única proteção.

### Chave do servidor — `GOOGLE_MAPS_SERVER_KEY`
Usada só pelas rotas da API (Routes API e Places Text Search). Nunca use `NEXT_PUBLIC_` nela. Sem ela, "Calcular percurso", "Otimizar", o GPX, a importação e a busca do assistente mostram um aviso. Para desenvolvimento local sem chave, use `MAPS_FAKE=1` (linhas retas e lugares fictícios).

**Pelo Console**
1. Ative a **Routes API** e a **Places API (New)** em **APIs e serviços → Biblioteca**.
2. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**, depois **Editar chave de API**:
   - Nome: `TripPlanner servidor`.
   - **Restrições de aplicativo → Nenhuma.** Referenciador HTTP não funciona em chamadas do servidor, e a Vercel não tem IP fixo.
   - **Restrições de API → Restringir chave** → marque só **Routes API** e **Places API (New)**.
3. Salve, copie a chave para `GOOGLE_MAPS_SERVER_KEY` no `.env` e nas variáveis da Vercel.

**Ou pelo CLI** (`gcloud auth login` antes):
```bash
gcloud services enable routes.googleapis.com places.googleapis.com --project <seu-project-id>
gcloud services api-keys create --project <seu-project-id> \
  --display-name="TripPlanner servidor" \
  --api-target=service=routes.googleapis.com \
  --api-target=service=places.googleapis.com
# o comando mostra o "keyString"; se não mostrar:
gcloud services api-keys list --project <seu-project-id>
gcloud services api-keys get-key-string <KEY_ID> --project <seu-project-id>
```

**Teste rápido** (deve devolver `distanceMeters` e uma lista de `places`; erro `403 PERMISSION_DENIED` indica API não ativada ou não incluída na restrição):
```bash
KEY=<sua-chave>
curl -s -X POST https://routes.googleapis.com/directions/v2:computeRoutes \
  -H "Content-Type: application/json" -H "X-Goog-Api-Key: $KEY" \
  -H "X-Goog-FieldMask: routes.distanceMeters,routes.duration" \
  -d '{"origin":{"location":{"latLng":{"latitude":-23.5614,"longitude":-46.6559}}},"destination":{"location":{"latLng":{"latitude":-23.5874,"longitude":-46.6576}}},"travelMode":"WALK"}'
curl -s -X POST https://places.googleapis.com/v1/places:searchText \
  -H "Content-Type: application/json" -H "X-Goog-Api-Key: $KEY" \
  -H "X-Goog-FieldMask: places.displayName" \
  -d '{"textQuery":"MASP São Paulo"}'
```

### Map ID (opcional) — `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
Habilita o estilo do mapa na nuvem (marcadores avançados com seu estilo e modo escuro). Sem ele o app usa `DEMO_MAP_ID`, que funciona normalmente.
1. **Google Maps Platform → Gerenciamento de mapas → Criar ID do mapa.**
2. Tipo **JavaScript**, renderização **Vetorial**. Salve e copie o ID.
3. Opcional: em **Estilos de mapa**, associe um estilo claro e um escuro ao ID.

### Gemini — `GEMINI_API_KEY`
Gere no [Google AI Studio](https://aistudio.google.com/) → **Get API key**. Só no servidor; nunca use `NEXT_PUBLIC_` nela.

### Login com Google (Auth.js v5)
1. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.**
2. Origens autorizadas: `http://localhost:3000` e `https://<seu-dominio>`.
3. URIs de redirecionamento: `http://localhost:3000/api/auth/callback/google` e `https://<seu-dominio>/api/auth/callback/google`.
4. Copie para `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET`. Gere `AUTH_SECRET` com `npx auth secret`.
5. Defina `OWNER_EMAILS` com o(s) seu(s) email(s) Google. Só eles e quem for convidado para uma viagem conseguem entrar (ADR-0007).

## 4. Rodando

```bash
npm install
cp .env.example .env   # e preencha
npm run dev            # http://localhost:3000
```

Verificações:

```bash
npm run lint
npm run typecheck
npm test               # testes unitários
npm run test:int       # integração no emulador do Firestore (requer Java 21)
npm run e2e            # Playwright (celular + desktop) contra o build de produção e o emulador
npm run build
```

Para rodar o build de produção fora da Vercel (`npm start`), defina `AUTH_TRUST_HOST=true` e `AUTH_URL`.

## 5. Modelos Gemini

Padrão: `gemini-4-argon`, com fallback automático para `gemini-4-hydrogen` em erro ou timeout. Cada tarefa (`CHAT`, `IMPORT`, `AGENT`) aceita `GEMINI_MODEL_<TAREFA>`, `GEMINI_THINKING_<TAREFA>` (`MINIMAL|LOW|MEDIUM|HIGH`) e `GEMINI_TIMEOUT_<TAREFA>_MS`. Os logs do servidor registram modelo, latência, uso de fallback e tokens (`[ai] task=...`).

## 6. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Cadastre as variáveis do `.env` (sem `AUTH_TRUST_HOST`, que a Vercel dispensa).
3. Adicione o domínio de produção nas restrições da chave do Maps e nas URIs do OAuth.
4. Para previews com login, configure `AUTH_REDIRECT_PROXY_URL` (o OAuth não aceita URLs de preview dinâmicas).
