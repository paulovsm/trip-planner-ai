# TripPlanner

Planejamento de viagens para uma pessoa e quem ela convida: o que visitar, em que dia, em que ordem e por qual caminho, inclusive para navegar no relógio. Termos canônicos em inglês (usados no código), com o rótulo da interface em português.

## Viagem e pessoas

**Trip** (Viagem):
Um plano com nome e período opcional, que reúne seus próprios Places e Days.
_Avoid_: plano, roteiro (para a viagem inteira)

**Owner** (Dono):
A pessoa que criou a Trip; a única que convida, gera Share Links e exclui a Trip.
_Avoid_: admin, criador

**Co-editor** (Coeditor):
Pessoa convidada que pode alterar Places e Days da Trip, mas não gerenciá-la.
_Avoid_: colaborador, membro (quando o papel importa)

**Invitation** (Convite):
Um email adicionado a uma Trip pelo Owner; enquanto pendente, também autoriza esse email a entrar no app.
_Avoid_: convite de acesso, permissão

## Lugares e roteiro

**Place** (Local):
Um lugar real e localizado que interessa à Trip, com categoria e marcação de Visited.
_Avoid_: Point, POI, ponto de interesse

**Visited** (Visitado):
Marcação de que um Place já foi visitado; vale para a Trip inteira, não para um Day.
_Avoid_: concluído, check-in

**Day** (Dia):
Uma data da Trip com uma sequência ordenada de Stops e um Travel Mode.
_Avoid_: Itinerary, itinerário

**Stop** (Parada):
A presença de um Place em um Day, numa posição, com horário, duração e notas opcionais.
_Avoid_: ItineraryItem, item

**Roteiro**:
O conjunto dos Days de uma Trip (termo apenas de interface).
_Avoid_: itinerary

## Deslocamento

**Travel Mode** (Modo de deslocamento):
Como se vai de uma Stop à seguinte em um Day: a pé, bicicleta, carro ou transporte público.
_Avoid_: modal, transporte (sozinho)

**Route** (Percurso):
O traçado calculado entre as Stops de um Day, na ordem atual, para um Travel Mode.
_Avoid_: direções, rota otimizada

**Leg** (Trecho):
A parte do Route entre duas Stops consecutivas.
_Avoid_: segmento, perna

**ETA** (Chegada prevista):
Horário estimado de chegada a uma Stop, derivado dos horários, durações e Legs.
_Avoid_: horário previsto

**Optimize** (Otimizar):
Reordenar as Stops de um Day para encurtar o Route, mantendo a primeira e a última.
_Avoid_: ordenar, calcular rota

**GPX Export** (Exportar GPX):
Arquivo de um Day (traçado mais Stops) para navegar no relógio; o app só exporta, nunca importa GPX.
_Avoid_: trilha, track (como nome de recurso)

## Compartilhamento e IA

**Share Link** (Link público):
Acesso somente leitura a uma Trip por um token, com validade e revogável; não mostra notas nem quem é o Owner.
_Avoid_: link de convite, compartilhamento (sozinho)

**Import** (Importar):
Extrair Places e Days de um documento ou foto, revisar e então gravar na Trip.
_Avoid_: upload, parsing

**Proposal** (Proposta):
Alteração sugerida pelo assistente que só acontece quando alguém a aplica.
_Avoid_: ação automática, sugestão (quando altera dados)
