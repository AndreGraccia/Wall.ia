# Changelog

## 26/10/2026: Radar de cobranças (em validação)

### Novo
- Tela autenticada para detectar recorrências, aumentos observados e possíveis duplicidades com evidências do histórico do titular.
- API determinística com próximo vencimento estimado, total mensal provável e aviso de sincronização antiga.
- Alertas de possível duplicidade e de valor fora do padrão, decisões do usuário persistidas por titular/transação e exportação da decisão na conta.
- Simulação de possível estorno comparando menor saldo e dias negativos no horizonte de 90 dias; é uma entrada hipotética, sem mudar transações reais nem contactar o banco.
- Regra separada do detector de recorrências geral para que uma mudança de preço não faça a cobrança desaparecer do radar.
- Testes de domínio para aumento, recorrência estável, possíveis duplicidades, transferências/entradas genéricas, cobranças sem cadência mensal, decisões de alertas e estorno hipotético.

### Limites
- O sinal não prova fraude; compras repetidas podem ser legítimas.
- O produto não cancela assinaturas nem movimenta dinheiro.
- A implementação está em branch separada e aguarda os workflows CI/E2E antes de ser integrada.


Mudanças da branch `feat/wallia` em relação à `main`, agrupadas por tema. Datas no fuso de Brasília.

## 26/09/2026: consentimento como registro (Sprint 16, B42)

### Novo
- **Cada consentimento do Open Finance tem registro próprio (ADR 0018, V32).** Antes, conectar de novo sobrescrevia o consentimento anterior e não sobrava prova dele. Agora cada um guarda finalidade, validade, permissões (em tabela) e a versão e o idioma do texto que a pessoa leu ao autorizar; cada mudança de estado vira um evento que só é acrescentado. A exportação traz tudo isso.
- **Autorizar exige a versão do texto.** Sem ela, 422 `OPEN_FINANCE_TERMS_UNKNOWN` e nada é autorizado. O texto do consentimento tem um hash conferido no `test:i18n`: mudar o texto sem versão nova reprova o CI.

### Corrigido durante o trabalho
- Um pedido sem a versão dava 500 em vez de 422: `Set.of(...).contains(null)` lança exceção em Java. O teste de integração pegou; a checagem de nulo vem antes.

### Verificado
- Backend: 361 testes, 0 falhas, 0 pulados, com JaCoCo. A migração foi testada com um consentimento revogado de antes da V32: permissões e histórico saem certos.
- Frontend: 67 testes, lint, Prettier, i18n e build. A trava do texto foi provada: mudar uma palavra reprova o `test:i18n`.

## 26/09/2026: CI conferido e dependências

### Corrigido
- **O CI do frontend falhava desde a Sprint 12 (B01).** O teste de fuso trocava o `TZ` dentro do arquivo, o que não vale num worker do Jest já iniciado. Em máquina brasileira passava por coincidência; no runner em UTC, não. O fuso de São Paulo agora é fixado no `globalSetup`. Reproduzido com `TZ=UTC` antes e depois.
- **npm audit (B02).** De 68 alertas para 25, sem crítico. `axios` 1.20 e `react-router-dom` 6.30 (o que vai para o navegador); `web-vitals` removido. Os 9 altos restantes são do `react-scripts`, só no build (B07).

### Novo
- **Testes de controller para as rotas que faltavam (B04).** Carteiras: a de outro usuário dá 403, dinheiro só sai de IBAN do próprio usuário e a carteira não pode ser passada para outra pessoa. Login: limite gasto dá 429 sem conferir a senha, senha errada não devolve a tentativa, confirmação de e-mail conta como tentativa. Futuro, Análises, Mercado e Open Finance: sem token nada roda, horizonte fora de 30/60/90 dá 400, pergunta com limite gasto dá 429, rotas de admin dão 403 e uma falha ao gravar a previsão não derruba a sincronização.

### Verificado
- Com `gh`: o E2E do GitHub já estava verde; o backend do CI também.
- Frontend com `TZ=UTC`: 67 testes, lint, Prettier, i18n e build.
- Backend: 358 testes, 0 falhas, 0 pulados, no JDK 25 da máquina do dono, com o gate do JaCoCo.
- CI e E2E do GitHub verdes no `18d0858`.
- A imagem do frontend refeita pelo Dockerfile com as dependências novas: coberta pelo E2E do GitHub, que monta a pilha pelos Dockerfiles de produção. A pilha local ainda roda a imagem anterior.

## 25/09/2026 (noite): Sprint 15, plataforma nova

### Mudou
- **Spring Boot 4.1.1 e Java 25 (B35, ADR 0017).** A linha 3.5 estava sem suporte gratuito desde 30/06/2026. Trouxe junto Jackson 3, Spring Security 7, starters modulares (Flyway, testes), springdoc 3.1.1 e JaCoCo 0.8.15. Feito numa branch separada, em dois passos, com a suíte verde em cada um. **Quem desenvolve precisa do JDK 25** ([`pendencias-do-dono.md`](docs/pendencias-do-dono.md), passo 1.1).

### Novo
- **Observabilidade (B36).** Todo job agendado é medido no `JobLock`: duração por resultado (sucesso, falha, pulado) e horário do último sucesso. Métricas no formato Prometheus só na rede interna; logs em JSON (ECS) na produção. Alertas recomendados em [`operacao.md`](docs/operacao.md), seção 5.
- **Aviso de dado atrasado no Futuro (B50).** A tela diz de quando são os dados do banco e mostra um alerta, antes de qualquer número, quando a última sincronização passou de 36 horas.
- **Testes das rotas de admin (B04).** Sem token dá 401, usuário comum dá 403 e o serviço nem roda; admin lê métricas e auditoria e dispara o sync.

### Verificado
- Backend: 334 testes, 0 falhas, 0 pulados, no Boot 4 com Java 17 e de novo num container com JDK 25 (classes em major version 69).
- Imagem Java 25 na pilha local: `healthy`, E2E no navegador passou inteiro, OpenAPI 3.1 com 47 rotas quando ligado.
- Frontend: 67 testes, lint, Prettier, i18n e build.
- Não verificado: CI e E2E no GitHub (sem `gh`).

## 25/09/2026 (noite): Sprint 14, ponta a ponta

### Novo
- **E2E no navegador (B05).** `frontend/e2e/journey.cjs` percorre o roteiro de homologação no Chromium: cadastro com o código lido no Mailpit, Futuro, Compromissos, Análises, Open Finance e Privacidade em 375 e 1280 px (sem erro na tela e sem rolagem lateral), conectar, autorizar e revogar o Open Finance, e baixar os dados. Erro de JavaScript ou resposta 5xx reprova. Workflow `E2E` separado do CI, com a pilha montada pelos Dockerfiles de produção.
- **`@WebMvcTest` do `AccountController` (B04).** Exportação e exclusão sem token dão 401; a exportação é do próprio usuário e não gasta tentativa de login; exclusão sem senha para antes do serviço.

### Corrigido
- **A interface montada nesta noite não alcançava a API.** O build feito no Git Bash transformou `REACT_APP_API_URL=/api/v1` em `C:/Program Files/Git/api/v1`. Os testes por `curl` não viam isso; o E2E viu. Refeito com `MSYS_NO_PATHCONV=1`, e o E2E passou inteiro. Afetou só as imagens locais montadas fora do Docker, não o Dockerfile.

### Medido
- Tela Futuro em 375 px, com dados do Open Finance: 5.816 px de altura (B51). Continua longa mesmo com as seções recolhíveis; vira trabalho de UX.

### Verificado
- E2E: passou inteiro contra a pilha local.
- Backend: `AccountControllerWebTest` com 4 testes; suíte completa em 324.
- Não verificado: o workflow `E2E` no GitHub (sem `gh`).

## 25/09/2026 (noite): Sprint 13, produção segura, e o git arrumado

### Novo
- **Rotação da chave de criptografia (B23, ADR 0016).** Valores novos saem como `enc:v2:<id da chave>:`. `data_encryption_previous_keys` lê dados de chaves antigas, e um job às 3h45 regrava em lotes o que não está na chave atual, incluindo as linhas antigas em texto puro. `enc:v1:` continua legível.
- **Backup e restauração testados (B32).** `scripts/backup.sh` (14 dias por padrão) e `scripts/restore-check.sh`, que restaura num PostgreSQL descartável e mostra versão e contagens. Rodado no banco de dev: V31, 32 usuários, 36 carteiras, 1003 lançamentos, iguais ao original.
- **Manual de operação** ([`docs/operacao.md`](docs/operacao.md)): TLS com proxy na frente e HSTS (B33), backup, rotação de chave e resposta a incidente com o prazo da ANPD (B25).

### Corrigido
- **Limites por IP virariam um limite só para todos atrás do proxy TLS.** O nginx repassava o IP do proxy como se fosse o do cliente. Agora confia no `X-Forwarded-For` só vindo de faixa privada (`set_real_ip_from`). Testado: 6 logins errados do cliente A bloqueiam A (429) e o cliente B continua livre.
- **Frontend publicado em todas as interfaces.** A porta 3001 agora só escuta em `127.0.0.1`; a entrada pública é o proxy com TLS.
- **Compilação no JDK 21 aceitava API que o JRE 17 da imagem não tem.** O `maven-compiler-plugin` usa `<release>17</release>` em vez de `source`/`target`. Provado com uma chamada a `List.getFirst()`, que agora não compila.

### Git
- `.gitattributes` com LF em todo arquivo de texto e CRLF só em `.cmd`, `.bat` e `.ps1`, nos dois repositórios. Acabam os avisos de CRLF e o falso alarme do Prettier no Windows; o índice já estava em LF, então nenhum conteúdo mudou.
- `main` local realinhada com a `origin/main`. Os 9 commits que só ela tinha já estavam todos na `feat/wallia`.

### Verificado
- Backend: 320 testes, 0 falhas, 0 pulados, contra PostgreSQL 14.6.
- Pilha reconstruída com as imagens novas, tudo `healthy`.

## 25/09/2026 (noite): Sprint 12, dados do titular

### Novo
- **Baixar meus dados (B20, LGPD art. 18, II e V).** `GET /api/v1/account/export` e botão na tela Privacidade. Um JSON com tudo o que existe sobre a pessoa, descrições decifradas e datas em ISO. Hash da senha, hash do código de e-mail e chaves do aviso no navegador ficam de fora; as colunas são uma lista fechada, então coluna nova não vaza por padrão (ADR 0015).
- **Retenção automática (B22).** Job diário às 3h30 apaga códigos de e-mail com mais de 30 dias, snapshots da previsão com mais de 400 dias e auditoria de admin com mais de 1 ano. Prazos e motivos no ADR 0015. `retention_cron=-` desliga.

### Corrigido
- **A tela Privacidade prometia mais do que a exclusão faz (B21).** Dizia "apaga o cadastro". A exclusão troca nome, usuário e e-mail, invalida a senha e mantém as carteiras com movimentação e o histórico, porque uma transferência aparece também no extrato da outra pessoa. O texto agora diz isso e sugere baixar os dados antes.
- **Cascata perigosa em `User.wallets` (B26).** `CascadeType.ALL` faria um `delete` de usuário levar as carteiras e, por elas, os lançamentos da outra pessoa. Ninguém usava; removida, com teste que impede a volta. Os métodos `addWallet`/`removeWallet`, sem uso, saíram.

### Verificado
- Backend: 314 testes, 0 falhas, 0 pulados, contra PostgreSQL 14.6 em banco limpo.
- Frontend: lint, Prettier, i18n, 65 testes e build.

## 25/09/2026 (noite): Sprint 11, homologação possível

Backlog novo e fluxo de entrega em [`docs/backlog.md`](docs/backlog.md).

### Corrigido
- **CI vermelho desde a Sprint 9.** O `prettier --check` falhava em 3 arquivos do frontend e os testes do frontend e o build nunca rodavam no GitHub. Formatados, e o `reportWebVitals.js` (chamado sem função, não media nada) removido.
- **Parcela no cartão perdia centavos (B10).** R$ 100,00 em 3 aparecia como 3 x R$ 33,33 nas faturas projetadas. Agora a 1ª parcela leva o resto (R$ 33,34), a mesma divisão do simulador, e a soma fecha com o valor da compra.
- **Receita e despesa escondidas como transferência (B11).** Um boleto pago numa conta e um Pix recebido em outra, de mesmo valor e no mesmo dia, sumiam dos totais de Análises. Agora só se pareiam lançamentos importados, de contas diferentes, com tipo de transferência do Open Finance (Pix, TED, DOC, TEF, mesma instituição). O tipo passa a ser gravado (V31). Lançamentos digitados à mão nunca se pareiam.

### Novo
- **Health check (B31).** `/actuator/health/liveness` e `/actuator/health/readiness`, sem detalhes. A readiness fica `DOWN` quando o banco cai; a liveness não, para a API não reiniciar em ciclo. Só `health` é exposto, e o nginx não repassa `/actuator`.
- **Compose de homologação e produção (B30).** Banco com `pg_isready`, backend com health check, e cada serviço só sobe depois do anterior saudável. `container_mail_host` passou a ser obrigatório: produção nunca cai no Mailpit por omissão. É separado do `mail_host`, que a API rodando fora do Docker também lê. Roteiro de homologação no guia (seção 13.1).

### Melhorado
- GitHub Actions `checkout`, `setup-java` e `setup-node` na v5 (runtime Node 24; a v4 avisava Node 20 depreciado).

### Verificado
- Backend: 311 testes, 0 falhas, **0 pulados**: a suíte rodou contra PostgreSQL 14.6 no Docker, com a V31.
- Imagem do backend construída e rodada: health check `healthy`; com o banco parado, readiness `DOWN` e liveness `UP`.
- Frontend: lint, Prettier, i18n, 63 testes e build.
- Não verificado: o CI do GitHub depois do push (sem `gh`) e o `npm audit` (registry bloqueado na rede corporativa).

## 25/09/2026 (noite): Sprint 10, integridade do consentimento e diferenciais

### Corrigido
- **Consentimento vencido nunca ficava gravado.** O `sync` marcava o consentimento como vencido e respondia 428 dentro da mesma transação, e o rollback desfazia a marcação. O consentimento ficava `AUTHORISED` para sempre, o sync diário tentava todo dia e os dados importados nunca saíam. O mesmo acontecia com o pedido de consentimento vencido depois de 60 minutos. Agora a expiração é gravada numa transação própria e apaga os dados importados.

- **Revisão de segurança independente**, com dois achados corrigidos e testados:
  - `?extra=1e-40000000` passava na validação de faixa e custava 14 s de CPU por requisição. Agora escala e precisão são conferidas antes de qualquer conta.
  - O nome anonimizado da conta excluída era previsível e aceito pelo cadastro. Registrá-lo antes travava a exclusão de outra pessoa. Agora usa `#`, que o cadastro recusa.

### Novo
- **Revogação feita no app do banco.** Antes de ler, o gateway de participante consulta `GET /consents/v3/consents/{id}`. Se o banco diz `REJECTED`, a conexão é encerrada com o motivo que o banco informou, e os dados são apagados.
- **Quitar mais rápido** (Compromissos). Compara maior juro primeiro e menor saldo primeiro com só pagar as parcelas: meses, juros e quanto cada ordem economiza. Nenhum crédito é oferecido (ADR 0013, `GET /api/v1/future/debt-payoff`).
- **Criptografia em repouso.** Descrições de lançamentos e de compras no cartão ficam gravadas com AES-256-GCM. A chave é obrigatória em produção (ADR 0014, V30).

### Melhorado
- Metas passaram a usar a mesma conta de aportes do simulador de Análises, em vez de uma cópia.
- Conferido no repositório oficial da OFB que não saiu versão de API depois de 19/12/2025.

### Verificado
- Backend: 307 testes, 0 falhas, 14 pulados (precisam de PostgreSQL).
- Frontend: 63 testes, lint, paridade PT/EN (784 chaves) e build.

## 25/09/2026 (tarde): Sprint 9, sem rede externa

### Novo
- Tela "Privacidade e dados": o que a Wall.ia guarda e para quê, o que vai para a IA (só totais por mês, e só com chave do Gemini) e o botão de excluir a conta.
- Excluir a conta (`POST /api/v1/account/delete`, com a senha). Apaga o que é só da pessoa e anonimiza o cadastro. As transferências continuam no extrato de quem recebeu, sem o nome de quem saiu (ADR 0012).
- Metas mostram quanto 12 meses viram a 100% do CDI, antes do IR, e quanto isso vale descontada a inflação, com a data do Banco Central.
- No celular, a tela Futuro recolhe as perguntas já respondidas, o Simulador e as Metas em uma linha cada. A resposta principal continua aberta.
- Análises diz na própria tela que conta pela data em que o dinheiro se moveu: a compra no cartão entra no dia em que a fatura é paga (ADR 0011).

### Corrigido
- Apagar uma carteira ou um tipo não leva mais junto as transações da contraparte (tirado o `CascadeType.ALL`).
- Páginas da API no formato estável do Spring (`page.totalPages`). O aviso "Serializing PageImpl instances as-is" sumiu.
- Portas padrão 8082 (API) e 3001 (tela), sem disputar 8080 e 3000 com outros projetos.

### Testes
- Um teste varre todos os controllers e falha se um endpoint com id na URL não conferir quem pede.
- `@WebMvcTest` do extrato com a cadeia de segurança real: 401 sem token, 403 para outro usuário, dono com teto de página.
- Exclusão de conta: senha errada não apaga nada; nenhuma instrução apaga `transaction` nem a linha do usuário.

### Documentação
- Guia do desenvolvedor e roteiro de teste com o cadastro por código, o consentimento Open Finance, o Banco Central e o teste de integração.
- Trilha de estudos: laboratórios cadastram e confirmam o e-mail pelo Mailpit.

### Verificado
- Backend: 290 testes, 0 falhas, 14 pulados (precisam de PostgreSQL; o Docker não estava disponível).
- Frontend: 61 testes, lint, paridade PT/EN (765 chaves) e build.

## 25/09/2026: dados do Banco Central e fechamento das sprints 4 a 7

### Novo
- Custo do negativo calculado com a taxa média do banco do usuário publicada pelo Banco Central, ou com a mediana dos bancos quando o banco não é encontrado. Os juros nunca passam do teto legal de 8% ao mês, e o IOF vem somado. A tela e o e-mail mostram de onde veio a taxa (ADR 0010, V29).
- `GET /api/v1/market/overview`: taxas de cheque especial, rotativo e crédito pessoal, mais CDI, Selic e IPCA. Os dados ficam em cache diário no banco e são buscados às 6h.
- Compromissos:
  - pagamento mínimo da fatura, com aviso sobre o rotativo e sobre o limite de encargos da Lei 14.690/2023;
  - CET do empréstimo;
  - taxa do contrato comparada com a mediana do mercado;
  - quadro com as referências do Banco Central.
- "Sair de todos os dispositivos".

### Corrigido
- Textos que o motor escreve (gastos do dia a dia, transferências, "média dos últimos N dias") saíam em português com a tela em inglês. Agora vêm por código (`labelKey`/`originKey`) e são traduzidos.
- O extrato só trazia os 100 lançamentos mais recentes. Agora lê todas as páginas, até 10 mil lançamentos.
- A tela do banco no consentimento Open Finance piscava vazia ao fechar.
- A linha de parcelas do empréstimo ficava espremida em 375 px.

### Verificado
- Backend: 280 testes, contando o de integração com PostgreSQL 14.6 e as migrações até a V29.
- Frontend: 55 testes, lint, i18n e build.
- Navegador (Playwright, pelo DOM): 9 telas em PT e EN, a 375 e 1280 px. Nenhum estouro horizontal, nenhuma chave i18n crua e nenhum erro no console.

## 24/09/2026: auditoria e sprints 0 a 6

Veja [`docs/plano-de-evolucao.md`](docs/plano-de-evolucao.md) e [`docs/auditoria-2026-09-24/`](docs/auditoria-2026-09-24/).

- Predição:
  - salário que vira o mês não some mais da projeção;
  - dia útil bancário (ADR 0007);
  - juros do SAC corrigidos;
  - dia de vencimento contratual (V23);
  - limite diário com a renda chegando amanhã.
- Análises:
  - mês calculado no fuso de Brasília;
  - transferência entre contas próprias não conta como receita;
  - a chamada à IA roda fora da transação.
- Segurança:
  - consentimento do sandbox de participante preso a um único usuário;
  - e-mail confirmado no cadastro (V24, ADR 0008);
  - JWT com emissor e audiência validados, e revogação de todos os tokens (V28);
  - sessão expirada volta ao login em qualquer tela.
- Open Finance no padrão oficial:
  - ciclo de consentimento `AWAITING_AUTHORISATION`/`AUTHORISED`/`REJECTED` (V25);
  - paginação por `links.next`;
  - cartões, empréstimos e `/resources`;
  - lançamentos futuros na projeção (V26, ADR 0009).
- API:
  - extrato paginado no banco;
  - índices (V27);
  - status HTTP por tipo de erro;
  - Gemini com retry;
  - jobs com advisory lock.
- Frontend:
  - code splitting por rota;
  - skeletons;
  - gráfico responsivo;
  - cabeçalho em 320 px;
  - valores em centavos.

## Antes

Motor Futuro, limite diário, perguntas, plano de saída, metas, envelopes, placar de precisão, Pix simulado, alertas por e-mail e Web Push, sync diário e auditoria admin. Veja os ADRs 0001 a 0006.
