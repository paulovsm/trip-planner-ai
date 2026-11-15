# Novo esquema começa num banco limpo, sem migração

O modelo Trip → Day → Stop → Place com membros, versões e Routes substitui o esquema antigo (`points`, `itineraries`, `userId`). Os dados existentes eram de teste, então decidimos não migrar: o app passa a usar um banco Firestore novo e nomeado (`FIRESTORE_DATABASE_ID`), e todo documento lido é validado contra o schema zod (`schemaVersion: 2`).
