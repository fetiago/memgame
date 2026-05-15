# Memorizador de Textos

Um site estático para treinar memorização ativa de textos.

A mecânica é simples: o app funciona como um cabeçote que passa pelo texto. Em cada trecho, as palavras são embaralhadas. Você reconstrói a ordem correta; quando acerta, o trecho deixa de ser jogo e vira texto revelado.

A ideia não é reler passivamente. É reconstruir.

## Como usar

1. Abra o site.
2. Clique em **Selecionar livro JSON**.
3. Escolha o arquivo `.json` do texto.
4. Selecione uma fase, se quiser começar por um parágrafo específico.
5. Monte o trecho clicando nas palavras na ordem correta.
6. Use **Workout dos erros** para repetir os trechos mais difíceis.
7. Use **Baixar progresso** para salvar um backup da sessão.

## Fases

Cada parágrafo do texto vira uma fase.

Os botões numerados representam os parágrafos. A cor indica desempenho aproximado:

- verde: fase com acertos registrados;
- amarelo: fase com média baixa de erros;
- vermelho: fase com média alta de erros;
- azul: fase atual.

A ordem das fases não muda. Isso preserva a orientação espacial durante o treino.

## Texto revelado

O texto revelado mostra o texto desde o começo até a posição atual do cabeçote. O que ainda não foi alcançado não aparece.

Quando um trecho é acertado, ele entra no quadro como texto normal. Não vira uma coleção de botões ou palavras separadas. Isso mantém a leitura leve e limpa.

## Erros e workout

Cada clique em palavra errada registra um erro. A palavra errada fica marcada em vermelho até você acertar a próxima palavra correta.

O workout usa os erros acumulados para montar uma sessão de reforço. Se uma frase longa foi dividida em partes, o workout treina todas as partes daquela frase em sequência, para preservar a lógica do texto.

Ao acertar um trecho no workout, apenas um erro é subtraído daquele trecho. Erros cometidos durante o workout também são registrados.

## Progresso

O progresso é salvo no navegador e pode ser exportado em JSON.

O arquivo de progresso não copia o livro inteiro. Ele guarda apenas:

- chave do texto;
- posição atual;
- modo de treino;
- estatísticas de erro, tentativa e acerto.

Para continuar depois, carregue o livro JSON e importe o JSON de progresso correspondente.

## Formato básico do JSON do livro

```json
[
  {
    "titulo": "Meu Texto",
    "paragrafos": [
      "Primeiro parágrafo.",
      "Segundo parágrafo."
    ]
  }
]
```

Também funciona com parágrafos divididos em frases:

```json
{
  "titulo": "Meu Texto",
  "autor": "Nome do autor",
  "paragrafos": [
    {
      "id": "p001",
      "tipo": "narracao",
      "texto": "Primeiro parágrafo completo.",
      "frases": [
        { "id": "p001_s001", "texto": "Primeira frase." },
        { "id": "p001_s002", "texto": "Segunda frase." }
      ]
    }
  ]
}
```

O segundo formato é melhor para textos longos, porque preserva parágrafos e frases.

## Privacidade

O livro e o progresso são processados no próprio navegador. Nada é enviado para servidor.

