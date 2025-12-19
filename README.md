# TripPlanner AI

TripPlanner AI é uma aplicação web inteligente para planejamento de viagens, projetada para ajudar viajantes a criar, organizar e otimizar seus roteiros de forma eficiente. Com integração de Inteligência Artificial e mapas interativos, o TripPlanner transforma a complexidade de planejar uma viagem em uma experiência simples e agradável.

## 🚀 Funcionalidades Principais

- **Planejamento Inteligente**: Crie viagens detalhadas com datas, destinos e pontos de interesse.
- **Otimização de Rotas**: Organize automaticamente a ordem das visitas para economizar tempo, com suporte para diferentes modos de transporte (Carro, Transporte Público, A pé).
- **Mapa Interativo**: Visualize todos os seus pontos e rotas em um mapa dinâmico do Google Maps.
- **Assistente de IA (Gemini)**: Converse com um assistente virtual integrado para receber dicas personalizadas, sugestões de restaurantes e atrações.
- **Importação de Documentos**: Importe reservas e tickets (PDF/Docx) para extrair informações automaticamente para o seu roteiro.
- **Itinerário Detalhado**: Gerencie suas atividades dia a dia, com funcionalidade de arrastar e soltar para reordenar.
- **Geocodificação Automática**: Adicione pontos apenas pelo nome ou endereço e deixe o sistema encontrar a localização exata.
- **Compartilhamento**: Compartilhe seus roteiros com amigos e familiares através de links públicos.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/).
- **Backend**: Next.js API Routes (Server Actions).
- **Banco de Dados & Auth**: [Firebase](https://firebase.google.com/) (Firestore, Authentication).
- **Mapas**: [Google Maps Platform](https://developers.google.com/maps) (Maps JS API, Places API, Directions API, Geocoding API).
- **Inteligência Artificial**: [Google Gemini API](https://ai.google.dev/).
- **Gerenciamento de Estado**: React Query, Zustand.

## 📦 Instalação e Configuração

Para rodar o projeto localmente, siga os passos abaixo:

1. **Clone o repositório**
   ```bash
   git clone https://github.com/paulovsm/trip-planner-ai.git
   cd trip-planner-ai
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente**
   Crie um arquivo `.env` na raiz do projeto com as seguintes chaves (baseado no `.env.example`):

   ```env
   # Google Maps
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_aqui

   # Firebase (Client & Admin)
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY=...

   # Google Gemini AI
   GEMINI_API_KEY=sua_chave_aqui

   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=sua_chave_secreta
   ```

4. **Execute o projeto**
   ```bash
   npm run dev
   ```

   O servidor iniciará em `http://localhost:3000`.

## 📱 Estrutura do Projeto

- `/app`: Rotas e páginas da aplicação (Next.js App Router).
- `/components`: Componentes React modulares.
  - `/features`: Funcionalidades específicas (mapa, chat, otimizador).
  - `/ui`: Componentes de interface reutilizáveis.
- `/lib`: Configurações de serviços externos (Firebase, Gemini, Maps).
- `/types`: Definições de tipos TypeScript.

## 📄 Licença

Este projeto está licenciado sob a licença MIT.
