# TripPlanner

TripPlanner é uma aplicação web moderna para planejamento de viagens, permitindo aos usuários criar itinerários detalhados, visualizar rotas no mapa e compartilhar seus planos com amigos.

## Funcionalidades Principais

- **Planejamento de Viagens**: Crie viagens com datas, destinos e atividades.
- **Itinerário Detalhado**: Organize atividades por dia e horário.
- **Mapa Interativo**: Visualize locais e rotas usando Google Maps.
- **Assistente de IA**: Converse com uma IA (Gemini) para obter sugestões de locais e dicas de viagem.
- **Compartilhamento**: Gere links públicos para compartilhar seus itinerários.
- **Login Social**: Autenticação segura com Google.

## Tecnologias Utilizadas

- **Frontend**: Next.js 16 (App Router), React, Tailwind CSS, Shadcn UI.
- **Backend**: Next.js API Routes.
- **Banco de Dados**: PostgreSQL com Prisma ORM.
- **Autenticação**: NextAuth.js.
- **Mapas**: Google Maps JavaScript API, Places API, Directions API.
- **IA**: Google Gemini API.

## Começando

Para configurar o projeto localmente, consulte o [Guia de Configuração](SETUP.md).

## Estrutura do Projeto

- `/app`: Páginas e rotas da API (Next.js App Router).
- `/components`: Componentes React reutilizáveis.
  - `/features`: Componentes específicos de funcionalidades (mapa, chat, viagens).
  - `/ui`: Componentes de interface genéricos (botões, inputs, etc.).
- `/lib`: Utilitários e configurações (Prisma, Utils).
- `/prisma`: Esquema do banco de dados e migrações.

## Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento.
- `npm run build`: Compila o projeto para produção.
- `npm start`: Inicia o servidor de produção.
- `npm run lint`: Executa a verificação de código (ESLint).

## Licença

Este projeto está licenciado sob a licença MIT.
