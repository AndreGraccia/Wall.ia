# ADR 0027: o assistente responde sobre plano, método, revisão e metas, e a pessoa confirma

Status: aceito e implementado em 27/11/2026. Não validado com pessoas.

## Contexto

O dono pediu duas vezes que a IA auxiliasse "no plano inteiro". As duas auditorias de 26/11 recomendam etapas: primeiro
responder com os dados da pessoa, depois preparar a ação e pedir confirmação; o modelo nunca calcula nem grava.

## Decisão

- O "Pergunte à Wall.ia" ganha quatro perguntas: como está o plano, qual método combina, o que falta revisar e quanto
  separar para juntar um valor até uma data.
- A escolha da pergunta continua determinística (`QuestionParser`). Nenhum modelo de linguagem participa: os números
  são do motor. Um classificador por LLM pode substituir o parser depois, sem mudar os cálculos (ADR 0002).
- A única escrita é a meta, e só depois do toque em "Criar esta meta", pelo endpoint que já existe.
- Sem data ou sem valor, o assistente pede; não inventa.
- Pergunta sobre investimento continua sem resposta, também quando vem junto de "juntar".

## Fora

Conversa com memória, ações em categorias e plano pelo chat, e interpretação livre por LLM (exige minimização de dados,
proteção contra injeção de instruções por descrições importadas e teste adversarial).
