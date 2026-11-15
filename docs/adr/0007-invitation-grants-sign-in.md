# Convite para uma Trip concede o direito de entrar no app

O login é só com Google e restrito a uma allow-list para evitar custo de IA e acesso de estranhos. Em vez de manter uma lista separada, ela é derivada: entram os donos em `OWNER_EMAILS` e qualquer email convidado para alguma Trip (`memberEmails`). Remover alguém de todas as Trips revoga o acesso; convites pendentes viram participação no primeiro login.
