# GPX é só exportação: um arquivo por Day, traçado mais Stops, sem elevação

O objetivo é navegar no Huawei Watch GT 7, que recebe rotas importadas no app Huawei Health a partir de arquivos GPX. O app exporta, por Day, o traçado denso do Route (`<trk>`) e as Stops como waypoints (`<wpt>`), nos modos a pé e bicicleta; Days de carro ou transporte podem gerar um Route a pé/bike só para o arquivo. Não importamos GPX e não incluímos elevação.

**Considered Options**: importar trilhas GPX de terceiros (fora do escopo por ora); incluir elevação via Elevation API (custo extra sem uso no relógio).

**Consequences**: o arquivo é gerado no cliente a partir do Route salvo, então funciona offline; densidade e presença de `<wpt>` são configuráveis conforme o teste no relógio real.
