# TripPlanner AI

Planejamento de viagens para você e quem você convidar: lugares, dias, ordem das visitas e percursos, com um assistente de IA e exportação de GPX para navegar no relógio (Huawei Health / GT 7). Vocabulário do domínio em [GLOSSARY.md](GLOSSARY.md); decisões de arquitetura em [docs/adr/](docs/adr/).

## Funcionalidades

- **Viagens com coeditores**: o dono convida pessoas por email; elas editam lugares e dias. Login só com Google, restrito a donos e convidados.
- **Lugares e roteiro por dia**: cada Day tem sua sequência de paradas (com horário, duração e notas) e seu modo de deslocamento (a pé, bicicleta, carro, transporte público).
- **Celular primeiro**: mapa em tela cheia com painel arrastável, arrastar e soltar paradas, modo escuro, app instalável (PWA) e leitura offline — marcar como visitado funciona sem internet e sincroniza depois.
- **Percursos e otimização**: percurso real de cada dia (Routes API), “Otimizar” com desfazer, horário previsto de chegada e tempo/distância entre paradas.
- **GPX para o relógio**: um arquivo por dia (traçado + paradas), a pé ou de bike, para importar no Huawei Health e enviar ao GT 7.
- **Importação com IA**: PDF, DOCX ou foto do roteiro; o Gemini extrai lugares e dias, o Google localiza cada um e você revisa antes de salvar.
- **Assistente (Gemini 4)**: conversa com o contexto da viagem, busca no Google e **propõe** alterações (adicionar paradas, montar dias, otimizar…) que só valem depois que você aplica.
- **Link público**: somente leitura, com validade e revogação, sem expor notas nem a identidade do dono.

## Tecnologias

- **App**: Next.js 16 (App Router, route handlers), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query.
- **Dados e auth**: Firestore via Firebase Admin SDK (sem acesso direto do cliente), Auth.js v5 com Google.
- **Mapas**: Google Maps Platform.
- **IA**: Gemini (`@google/genai`), `gemini-4-argon` com fallback `gemini-4-hydrogen`.
- **Qualidade**: zod em todas as entradas, Vitest (unidade + integração no emulador do Firestore), Playwright (celular + desktop, com axe), GitHub Actions.

## Começando

```bash
npm install
cp .env.example .env   # preencha conforme o SETUP.md
npm run dev
```

Guia completo de chaves, Firestore, OAuth e deploy: [SETUP.md](SETUP.md).

## Estrutura

- `app/` — páginas e rotas da API (`app/api/**/route.ts`, sempre via `withRoute`).
- `lib/domain/` — modelo de domínio: schemas zod (fonte dos tipos), regras puras e DTOs.
- `lib/server/` — autorização, rate limit, acesso ao Firestore e `commands/` (todas as escritas).
- `lib/ai/` — cliente Gemini, prompts e saneamento de dados não confiáveis.
- `lib/client/` — cliente tipado da API para o navegador.
- `components/` — componentes React (`features/`) e primitivas de UI (`ui/`).
- `tests/` — testes de integração (emulador) e de arquitetura.

## Licença

MIT.
