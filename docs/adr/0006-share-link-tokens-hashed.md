# Token do Share Link é guardado só como hash e mostrado uma única vez

Links públicos usam tokens de 256 bits; o Firestore guarda apenas `sha256(token)` como id do documento, com validade obrigatória (padrão 30 dias, máximo 1 ano) e revogação. Um vazamento do banco não revela links válidos. A consequência visível: o link não pode ser copiado de novo depois — para compartilhar outra vez, gera-se um novo.
