# Hover estável na borda inferior da mão

Em 03/11/2026, o usuário reportou que a carta da mão fica saindo ao manter o
mouse na parte inferior e pediu a correção. O pedido autoriza corrigir a
instabilidade preservando o leque e a elevação já existentes.

Quando a carta sobe, uma área transparente sob ela mantém o hover até o
mouse sair dessa região. O ajuste fica restrito à mão no desktop; não muda
contratos, persistência ou dependências.

Um teste de navegador com API/MySQL reais reproduziu a falha antes da correção:
o cursor parado na borda inferior não mantinha a carta elevada. A regressão
exercita cartas nas extremidades e no meio do leque em 1440×900 e 1280×720,
observando estabilidade em vários frames e liberação ao afastar o cursor.

Após a correção, passaram build/TypeScript e os dois testes desktop de
estabilidade na borda inferior e reordenação da mão.
