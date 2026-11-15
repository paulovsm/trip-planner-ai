# Stops ficam num array no documento do Day, alterado só por operações em transação

Um Day tem no máximo 50 Stops e quase toda leitura é "o Day inteiro"; reordenar e Otimizar mudam todas as posições e precisam invalidar o Route junto. Por isso as Stops são um array no documento `days/{dayId}` (posição = índice), e não uma subcoleção. Para que coeditores não percam edições, o cliente nunca envia "o array novo": envia operações (`moveStop`, `removeStop`…) que o servidor aplica numa transação Firestore. Cada mudança incrementa `version`; substituições da ordem inteira (Otimizar, Desfazer) exigem `expectedVersion` e recebem 409 se o Day mudou.

**Considered Options**: subcoleção `stops` com índice fracionário — melhor para listas grandes, mas torna reordenação e consistência com o Route um lote de N documentos.

**Consequences**: todas as edições de um Day disputam um documento (aceitável na escala de uma família); `visited` fica no Place para não disputar com o Day.
