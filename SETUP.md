# Guia de Configuração - TripPlanner

Este guia detalha como configurar o ambiente de desenvolvimento, obter as chaves de API necessárias (Google Cloud, Firebase/Supabase) e rodar o projeto.

## 1. Pré-requisitos

- Node.js 18+ instalado
- Conta no Google Cloud Platform
- Conta no Supabase (ou PostgreSQL local)

## 2. Configuração do Banco de Dados (Firebase)

O TripPlanner usa Firebase Firestore.

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Vá em **Criação > Firestore Database** e crie um banco de dados (modo de teste para começar).
3. Vá em **Configurações do Projeto > Contas de serviço**.
4. Clique em **Gerar nova chave privada**. Isso baixará um arquivo JSON.
5. Abra o arquivo JSON e copie os valores para o seu `.env`:
   - `project_id` -> `FIREBASE_PROJECT_ID`
   - `client_email` -> `FIREBASE_CLIENT_EMAIL`
   - `private_key` -> `FIREBASE_PRIVATE_KEY`

## 3. Configuração do Google Cloud Platform (GCP)

Você precisará de um projeto no GCP para Maps, Login e Gemini.

### 3.1 Criar Projeto
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um novo projeto (ex: `tripplanner-dev`).

### 3.2 Ativar APIs
No menu "APIs e Serviços" > "Biblioteca", ative as seguintes APIs:
- **Maps JavaScript API** (para o mapa no frontend)
- **Directions API** (para rotas)
- **Places API (New)** (para geocodificação e busca)
- **Generative Language API** (para o Gemini AI)

### 3.3 Criar Credenciais (API Keys)
Vá em "APIs e Serviços" > "Credenciais".

**Chave 1: Google Maps (Frontend)**
1. Clique em "Criar Credenciais" > "Chave de API".
2. Nomeie como `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
3. **Restrições de API**: Selecione apenas "Maps JavaScript API".
4. **Restrições de Aplicação** (Produção): Adicione seu domínio (ex: `tripplanner.vercel.app`). Para dev, pode deixar aberto ou adicionar `localhost:3000`.

**Chave 2: Google Maps (Backend)**
1. Crie outra chave. Nomeie como `GOOGLE_MAPS_API_KEY`.
2. **Restrições de API**: Selecione "Directions API" e "Places API".
3. **Restrições de Aplicação**: Selecione "Endereços IP" e adicione o IP do seu servidor (ou deixe sem restrição em dev).

**Chave 3: Gemini AI**
1. Se preferir, use o [Google AI Studio](https://aistudio.google.com/) para gerar uma chave específica para o Gemini.
2. Nomeie como `GOOGLE_GEMINI_API_KEY`.

### 3.4 Configurar OAuth (Login com Google)

**Importante**: Mesmo usando Firebase, o NextAuth precisa de credenciais OAuth do Google Cloud para realizar o login no servidor.

1. Ainda em "Credenciais" no Google Cloud Console, clique em "Criar Credenciais" > "ID do cliente OAuth".
2. Tipo de aplicativo: **Aplicação Web**.
3. **Origens JavaScript autorizadas**:
   - `http://localhost:3000`
   - `https://seu-dominio-producao.vercel.app`
4. **URIs de redirecionamento autorizados**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://seu-dominio-producao.vercel.app/api/auth/callback/google`
5. Copie o **ID do Cliente** e a **Chave Secreta do Cliente**.
6. Adicione ao seu `.env`:
   ```env
   GOOGLE_CLIENT_ID="seu-client-id"
   GOOGLE_CLIENT_SECRET="seu-client-secret"
   ```

## 4. Configuração do Ambiente (.env)

Renomeie o arquivo `.env.example` para `.env` e preencha as variáveis:

```env
# Banco de Dados (Firebase)
FIREBASE_PROJECT_ID="seu-project-id"
FIREBASE_CLIENT_EMAIL="seu-client-email@..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000" # Em produção, use a URL da Vercel
NEXTAUTH_SECRET="gere-uma-hash-aleatoria-aqui" # Use: openssl rand -base64 32

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="chave-frontend-maps-javascript"
GOOGLE_MAPS_API_KEY="chave-backend-directions-places"

# Google Gemini
GOOGLE_GEMINI_API_KEY="chave-gemini-ai"

# OAuth Providers
GOOGLE_CLIENT_ID="seu-client-id-oauth"
GOOGLE_CLIENT_SECRET="seu-client-secret-oauth"
```

## 5. Inicialização

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Acesse `http://localhost:3000`.

## 6. Deploy na Vercel

1. Faça push do código para o GitHub.
2. Importe o projeto na Vercel.
3. Nas configurações do projeto na Vercel, adicione todas as variáveis de ambiente do `.env`.
4. O deploy deve ocorrer automaticamente.
