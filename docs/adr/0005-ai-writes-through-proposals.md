# A IA só altera a viagem por Propostas confirmadas, usando os mesmos commands da interface

O assistente pode buscar lugares e montar Days, mas toda escrita que ele sugere vira uma Proposal (cartão Aplicar/Descartar). Ao aplicar, o servidor revalida os argumentos e executa exatamente os commands em `lib/server/commands` usados pela interface, com a mesma autorização. Assim um prompt injetado por um documento ou nome de lugar nunca grava nada sozinho.
