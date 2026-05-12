# Memorizador de Textos

Um site simples para treinar memorização de textos por reconstrução ativa.

A ideia é parecida com exercícios de montagem de frases: o texto é dividido em trechos, as palavras aparecem embaralhadas, e você precisa reconstruir a frase na ordem correta. Ao acertar, o trecho é revelado no quadro de leitura, formando o texto aos poucos.

Não é um leitor de texto.  
Não é um flashcard.  
É um treino de memória, atenção e reconstrução verbal.

## Como usar

1. Abra o site.
2. Clique em **Selecionar livro JSON**.
3. Escolha um arquivo `.json` com o texto preparado.
4. Selecione uma fase/parágrafo.
5. Monte os trechos clicando nas palavras na ordem correta.
6. Repita as fases com mais erros para reforçar os pontos difíceis.

## O que são fases?

Cada parágrafo do texto vira uma **fase**.

Isso permite dividir um texto longo em pequenas vitórias mensuráveis. Em vez de tentar memorizar tudo de uma vez, você treina parágrafo por parágrafo.

Por exemplo:

- um texto com 20 parágrafos vira 20 fases;
- cada fase pode ter uma ou várias frases;
- frases longas são quebradas em trechos menores;
- as fases com mais erros podem ser repetidas depois.

## Modos de treino

O site tem dois modos principais:

### Treinar por trechos/frases

Modo recomendado.

As frases são apresentadas em partes menores para evitar um quebra-cabeça grande demais. Quando uma frase é muito longa, o sistema tenta dividi-la em trechos equilibrados, usando pontuação como apoio.

### Treinar por parágrafos

Modo mais difícil.

O parágrafo inteiro vira um único exercício. Pode ser útil para revisão avançada, mas tende a ser mais pesado em textos literários longos.

## Como funciona o erro

Quando você clica em uma palavra errada, ela fica marcada em vermelho até você selecionar a palavra correta.

Isso evita ficar testando a mesma palavra errada várias vezes sem perceber.

O sistema registra erros por:

- fase;
- trecho;
- tentativa;
- conclusão da fase.

Assim, o erro deixa de ser só punição e vira informação: ele mostra onde o texto ainda não está firme.

## Progresso e backup

O site salva automaticamente o progresso no navegador usando `localStorage`.

Também é possível baixar um arquivo JSON com o progresso da sessão. Esse arquivo pode ser importado depois para continuar ou revisar o treino.

O nome do arquivo exportado inclui data e hora completas, para ajudar a identificar quando o backup foi feito.

Exemplo:

``` txt
progresso_uma-galinha_2026-05-12-14-59-33-241-gmt-menos-03-00.json
```

## Formato do JSON do texto

O site aceita arquivos JSON com uma lista de textos:

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

Também aceita uma estrutura mais detalhada, com parágrafos divididos em frases:

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
        {
          "id": "p001_s001",
          "texto": "Primeira frase."
        },
        {
          "id": "p001_s002",
          "texto": "Segunda frase."
        }
      ]
    }
  ]
}
```

O segundo formato é melhor para textos longos, porque permite treinar por frases e ainda preservar a organização por parágrafos.

## Privacidade

Os arquivos são processados no próprio navegador.

O texto carregado e o progresso não são enviados para servidor nenhum. O site funciona como uma página estática: você abre, carrega seu JSON e treina localmente.

## Para quem isso serve?

Este projeto pode ser útil para:

* atores decorando texto;
* estudantes memorizando trechos literários;
* pessoas treinando leitura atenta;
* quem quer transformar repetição textual em prática ativa;
* quem precisa revisar textos longos sem depender apenas de releitura passiva.

## Ideia central

Memorizar não é apenas reler.

Memorizar é reconstruir.

Este site transforma o texto em uma sequência de pequenas reconstruções: palavra por palavra, trecho por trecho, parágrafo por parágrafo.
