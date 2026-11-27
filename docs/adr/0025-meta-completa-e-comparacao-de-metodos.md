# ADR 0025: Meta com valor e data, e comparação de métodos

Status: aceito e implementado em 27/11/2026. Falta validar com pessoas.

## Contexto

A meta só tinha valor mensal e dia (B56). Quem quer juntar um valor até uma data não sabia quanto separar nem se cabia. Em "Meu método", dois métodos só podiam ser lidos um de cada vez.

## Decisões

### Meta

- `goal` ganha `target_amount`, `target_date` e `saved_amount`, todos opcionais (V39). Meta antiga continua igual. Data exige valor-alvo, na aplicação (`GOAL_DATE_NEEDS_TARGET`) e no banco.
- O valor guardado é **declarado** (`savedOrigin: USER_VALUE`, "informado por você"). Não é movimento, não cresce sozinho com o tempo e não entra no saldo.
- `GoalProgress` calcula com os mesmos dias de contribuição que a projeção usa (depois de hoje, no último dia em mês curto): falta, percentual (arredondado para baixo), contribuição necessária (arredondada **para cima** no centavo) e data prevista no valor atual. Estados: `REACHED`, `NO_DATE`, `DATE_TOO_SOON`, `ON_TRACK`, `LATE`. Sem rendimento nem inflação.
- "Cabe" compara os 90 dias **sem a meta** com os 90 dias **com a meta no valor necessário**, pelo mesmo motor do "ver se cabe", sem gravar. Não cabe quando cria dia negativo ou aprofunda um buraco existente (a regra do "Pergunte"). O plano do mês é refeito dos dois lados, então a fatia Futuro continua absorvendo as metas. Sem entrada confirmada, a resposta diz que só contou saldo e saídas.
- O histórico só é lido quando alguma meta tem contribuição necessária, uma vez por requisição.
- `PUT /api/v1/future/goals/{id}` substitui a meta inteira (campo ausente é apagado), só para o dono (404 `GOAL_NOT_FOUND`). A tela oferece desfazer na edição e na exclusão.
- Data passada é aceita: uma meta chega lá sozinha e o desfazer precisa restaurá-la. Volta como `DATE_TOO_SOON`. Datas a mais de 50 anos são recusadas (`GOAL_DATE_TOO_FAR`).
- **Meta alcançada não sai da projeção sozinha.** O compromisso é decisão da pessoa; a tela avisa que ele continua até a meta ser removida.

### Comparação de métodos

- Em Meu método, dois métodos lado a lado: como funciona, quando ajuda, limitação, esforço e resultado na projeção. O catálogo ganha `effort` (`LOW`, `MEDIUM`, `HIGH`), conteúdo editorial como os outros textos (versão `2026-11-27`).
- Só métodos com preset de fatias são simulados, por `POST /plan/fit`. Os presets chegam sem nada marcado, e simular assim daria o mesmo resultado para todos. A tela lista **antes do clique** a hipótese: separar todo mês as fatias que podem virar compromisso. Essenciais e lazer já estão na projeção. Nada é gravado.

## O que ficou de fora

- Pré-visualizar a contribuição necessária antes de salvar a meta (ela aparece ao salvar, com editar e desfazer).
- Escolher na comparação quais fatias separar; para isso há o Plano do mês.
- Ligar o valor guardado a uma conta ou envelope, aporte automático e rendimento no prazo.
