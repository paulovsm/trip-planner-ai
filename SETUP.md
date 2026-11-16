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

### APIs (APIs e serviços → Biblioteca)
- **Maps JavaScript API**
- **Geocoding API** (localização de lugares no navegador)
- **Directions API** (traçado no navegador; substituída pela Routes API na fase F3)
- **Places API (New)** (busca de lugares, a partir da fase F2)
- **Generative Language API** (Gemini) — ou gere a chave direto no [Google AI Studio](https://aistudio.google.com/)

### Chaves
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** (navegador): restrinja por **referenciador HTTP** (`http://localhost:3000/*`, `https://<seu-dominio>/*`) e às APIs acima de Maps. Ela fica pública no bundle; a restrição é a única proteção.
- **`GEMINI_API_KEY`**: só no servidor. Nunca use `NEXT_PUBLIC_` nela.

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
