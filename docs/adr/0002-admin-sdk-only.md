# Firestore só pelo Admin SDK no servidor, com regras que negam tudo

Toda leitura e escrita passa pelas rotas da API, que autenticam, validam com zod e checam a participação na Trip (`requireTripAccess`). O cliente não usa o SDK do Firebase e `firestore.rules` nega qualquer acesso direto. Isso mantém a autorização num só lugar, testado contra o emulador.

**Consequences**: não há listeners em tempo real; coeditores veem mudanças por refetch (ao focar a janela e periodicamente) e conflitos aparecem como 409.
