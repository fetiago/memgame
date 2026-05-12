# Memorizador de Textos

Um site estático para treinar memorização por reconstrução ativa.

Você carrega um livro em JSON, escolhe uma fase e reconstrói cada trecho clicando nas palavras embaralhadas. Conforme acerta, o texto vai sendo revelado no quadro principal, como um pergaminho que aparece aos poucos.

## Como usar

1. Abra o site.
2. No painel **Arquivos e sessão**, clique em **Selecionar livro JSON**.
3. Escolha o arquivo do texto.
4. No topo, reconstrua o trecho clicando nas palavras na ordem certa.
5. Use os quadradinhos de **Fases** para escolher o parágrafo que quer treinar.
6. Use **Workout dos erros** para reforçar os trechos em que mais errou.
7. Baixe o progresso antes de fechar se quiser manter um backup portátil da sessão.

## Fases

Cada parágrafo do texto vira uma fase.

A grade de fases mostra apenas o número de cada fase para não poluir o treino. Fases com erros acumulados aparecem destacadas. Os dados técnicos da fase atual ficam no fim da página.

## Progresso

O site mostra três progressos diferentes:

- progresso do texto completo;
- progresso da fase atual;
- progresso do trecho/frase atual.

A barra do trecho avança palavra por palavra. As barras da fase e do texto só avançam quando o trecho é concluído, porque a revelação só acontece depois do acerto completo.

## Voltar e avançar

Você pode voltar para trechos já revelados. Quando o trecho já foi concluído antes, o botão de avançar fica disponível para você navegar de volta até o ponto atual sem precisar refazer tudo.

Se quiser praticar de novo um trecho já revelado, use **Reiniciar trecho**.

## Workout dos erros

O botão **Workout dos erros** monta uma sessão de reforço com as frases que acumularam mais erros.

Quando uma frase longa foi dividida em dois ou mais trechos para não virar uma sopa de palavras, o workout treina todos esses trechos em sequência. Assim você reforça a frase inteira sem perder a lógica do texto.

## Erros

Quando uma palavra errada é clicada, ela fica vermelha até a próxima palavra correta ser encontrada. A mesma palavra errada não soma erro infinitamente no mesmo ciclo.

Os erros são salvos por fase e por trecho, permitindo reforçar os pontos mais difíceis.

## Progresso e backup

O navegador salva automaticamente o progresso localmente usando `localStorage`.

Você também pode usar:

- **Baixar progresso** para exportar um JSON de backup;
- **Importar progresso** para restaurar um backup anterior.

O arquivo exportado inclui um timestamp completo no nome.

## Privacidade

O site é estático. O texto e o progresso são processados no próprio navegador. Nada é enviado para servidor.
