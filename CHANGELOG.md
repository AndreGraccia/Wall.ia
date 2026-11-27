# Changelog

## 27/11/2026: auditorias externas, correções prioritárias

### Corrigido
- **Fatura paga antes do vencimento saía duas vezes:** o saldo já tinha o pagamento e a projeção descontava a fatura de novo no vencimento. Agora o pagamento que nomeia o cartão (parcial reduz o valor) ou que tem o valor exato de uma única fatura aberta tira a fatura da projeção e libera o limite. Na dúvida, nada é escondido.
- **Ocultar saldo desmontava a página**, descartando rascunho, filtro e refazendo consultas.
- No computador, o botão Perguntar ficava em cima do seletor de 90 dias do Futuro.
- O Radar aparecia ao mesmo tempo na aba "Contas" e na folha "Mais" no celular.

### Novo
- **Primeiros passos no Início:** conectar, confirmar a renda, responder as perguntas, escolher um método e criar uma meta; some quando tudo está feito, pode ser dispensado e volta pelo menu da conta.

## 26/11/2026: correções P0 das auditorias (ADR 0023)

### Mudou
- **A fatia Fixo vira Essenciais** e mede contas fixas mais mercado, saúde e transporte do mês. Lazer mede só o que o nome identifica como lazer; o resto aparece como não classificado.
- **O objetivo principal declarado entra nas sugestões de método**, com o motivo na tela.

### Corrigido
- Transferências de mesmo valor e dia com mais de um par possível não são mais escondidas.

## 26/11/2026 (noite): revisão de usabilidade (ADR 0022)

Auditoria das 17 telas em 1440 e 390 px e pesquisa de mercado com 19 produtos (`docs/produto/pesquisa-de-mercado-2026-11.md`).

### Mudou
- **Navegação pela pergunta do dia.** Menu em Visão (Início, Futuro, Plano do mês), Dinheiro (Entradas e saídas, Extrato, Envelopes), Compromissos (Cartões e dívidas, Radar) e Mais (Análise, Carteiras, Open Finance). "Dívidas" virou "Compromissos": o Radar lista aluguel e streaming, que não são dívida. Barra do celular: Início, Futuro, Plano, Contas, Mais.
- **"Perguntar" é uma ação no topo de todas as telas**, não um destino.
- **O número do dia diz a premissa:** "Gaste até R$ 15,37 por dia até 04/12 e nenhum dia fica negativo." Quando o ritmo atual leva ao negativo, uma linha diz quando: "No ritmo atual (R$ 27,40 por dia), o saldo fica negativo em 02/12."
- **Futuro:** os três números fecham a conta do limite (saldo agora + entra antes da renda − já tem destino = sobra ÷ dias). O eixo do gráfico acompanha os dados, e o trecho negativo aparece com pelo menos 8 px. A janela de 30 dias mostra 7 dias de passado. "Precisão da previsão" vira um item próprio.
- **Selo "Confirmado" sai.** Confirmado é o normal; só "Estimado" e "Simulado" têm selo.
- **Plano do mês abre em modo leitura.** O topo diz "Este mês faltam R$ X no plano" ou "sobram". "Próximos meses" vem logo abaixo, mês negativo diz "Falta" (antes dizia "Sobra" com valor negativo) e o editor abre em "Editar fatias". "Desativar plano" e "Ver métodos" ficam no menu "⋯". "Virar compromisso" virou "Tirar do saldo no dia da renda".
- **Meu método:** cada sugestão é uma linha que se escolhe inteira, e há um único "Usar este método".
- **Aviso de dados atrasados em uma linha** ("Dados de 24/11, 07:30 · Atualizar · Por quê?"). Antes ocupava 180 px no celular, acima do número do dia.
- **Listas:** a linha inteira abre o detalhe, não só a seta. No toque, botões, links e seletores têm 44 px.
- **Extrato:** linhas de 56 px, total líquido em cada mês, a transferência entre suas contas numa linha neutra só, e a forma de pagamento no detalhe.
- **Entradas e saídas:** um agrupamento por vez (categoria, forma de pagamento ou conta) e o mês com setas, no lugar do campo de seleção.
- **Cartões e dívidas:** o topo diz "Em dezembro saem R$ 1.560,48 em dívidas" com a fatura e a parcela. O Pix no crédito fica recolhido e as taxas do Banco Central passam para dentro de "Taxa, CET e custo".
- **Radar:** os contadores viram uma linha, e "nenhuma cobrança fora do padrão" também. Só o valor anualizado fica em âmbar.
- **Análise:** o relatório é gerado ao abrir e ao trocar o período, sem o botão "Gerar relatório".
- **Open Finance conectado:** mostra contas, última sincronização e "Sincronizar dados" primeiro, e o passo a passo só aparece sem conexão.
- **Envelopes vazio:** uma frase e o formulário, sem três números zerados.
- **Perguntar e Privacidade** alinhadas como as outras telas. Pergunta vazia aponta o campo, e o login ficou sem asteriscos.

### Corrigido
- **Parcela vencida aparecia como "próxima".** Agora mostra a próxima de verdade e diz "Venceu em 25/11, ainda não vimos o pagamento."
- **O Radar contava compra de mercado como cobrança recorrente.** No usuário de teste, o total caiu de R$ 3.179,18 para R$ 2.995,48 por mês. O critério: gasto do dia a dia cujo valor varia mais de 25% não entra; luz e aluguel continuam.
- **Ocultar saldo** só escondia os valores de Entradas e saídas depois de recarregar a página.
- A transferência entre contas próprias importada do Open Finance aparecia como entrada e saída no Extrato.

## 26/11/2026: Início completo, lançamentos em Entradas e saídas e ocultar saldo em todo o app

### Novo
- **Início.** Além do número do dia e dos totais do mês: saldo de hoje; o primeiro período em que o saldo pode ficar negativo, com as saídas que causam isso, a certeza e a origem de cada uma; o menor saldo e o saldo final em 30, 60 e 90 dias; o plano do mês com planejado e realizado por fatia; metas, envelopes e a reserva do plano; e o seu método, que decide qual bloco vem primeiro e diz por quê. Planejado nunca aparece como dinheiro já gasto ou investido.
- **Entradas e saídas.** A lista de lançamentos do mês, com data, conta, forma de pagamento e categoria. Clicar numa conta, forma ou categoria filtra a lista. Na aba de saídas do mês atual, "Ainda vai sair" mostra contas, fatura e parcelas previstas até o fim do mês, separadas do que já saiu.
- **Plano do mês.** Cada ponto de partida explica o que faz. No base zero, o que falta distribuir aparece em reais.

### Mudou
- **Ocultar saldo vale para todas as telas.** O olho saiu do Início e foi para o topo, ao lado da conta.
- **O método 35/20/15 com reserva se chama "Equilibrado 35/20/15".** Os métodos se chamam pelo que fazem, como o 50/30/20. Quem já tinha escolhido continua com ele (migração V37).

### Corrigido
- No Futuro e no Início, a fatia do plano aparecia como `PLAN_INVESTMENT` na lista de compromissos.
- **Lazer e investimento somava o investimento planejado como se já tivesse saído.** Com o plano ativo, o total incluía a fatia de investimento sem dizer. Agora a linha de baixo separa o gasto do planejado ("R$ 637,85 gasto + R$ 731,25 planejado").
- O alerta do Início ("o saldo pode chegar a −R$ 84,19") parecia contradizer o limite diário logo acima ("sem nenhum dia negativo"). Os dois estavam certos: o limite supõe gastar só ele, e o alerta usa o ritmo de gastos de sempre. A frase agora começa com "No seu ritmo de gastos".
- O resultado do "ver se cabe" continuava na tela depois de ativar o plano, comparando com o saldo de antes.

### Testes
- O E2E (`journey.cjs`) passa também por Início, Plano do mês, Meu método e Entradas e saídas, em 375 e 1280 px.

### Segurança e qualidade
- GitHub Actions fixadas pelo commit da versão, não pela tag, e `min-release-age=7` no npm do frontend: o npm 11 só instala versões publicadas há uma semana (KAN-34).
- SpotBugs: `FieldCipher` não pode mais ser estendida, e a ordenação de dias em `RecurrenceDetector` deixou de reembrulhar números. Os 9 avisos de `
` em formato ficam: são corpo de e-mail e texto para o Gemini, onde `%n` misturaria fins de linha no Windows (KAN-33).

## 25/11/2026: CI

- CI e E2E rodavam duas vezes por commit de PR; agora uma, com o run anterior cancelado. Frontend do CI no Node 22.

## 24/11/2026: telas do Plano do mês, Meu método e Entradas e saídas

### Novo
- As telas do contrato de 23/11: Plano do mês com "ver se cabe", Meu método com sugestões e motivo, Entradas e saídas e os três totais no Início.
- Ocultar saldo de volta no Início, lembrado no navegador.

### Corrigido
- **Radar de cobranças contava o pagamento da fatura e a transferência para a reserva como assinaturas.** No usuário de teste, o total mensal caiu de R$ 4.427,18 para R$ 3.179,18. A mesma correção vale para o Futuro.
- Valor negativo quebrava a linha entre o sinal e o "R$" no celular; agora usa o sinal de menos tipográfico.

## 23/11/2026: Plano do mês, entradas e saídas e "Meu método" (proposta de André Graccia)

Ideia de André Graccia, integrante do grupo, e documento de evolução do grupo. Decisões em [ADR 0021](docs/adr/0021-plano-do-mes-entradas-e-saidas-e-meu-metodo.md). Migrações V35 e V36. Telas em 24/11.

### Novo
- **Plano do mês.** A renda mensal confirmada dividida em até 12 fatias com nome próprio. A divisão do André (35% fixo, 20% lazer, 15% investimento, 7,5% futuro, 10% desenvolvimento pessoal e estudo, 12,5% reserva de emergência) é um dos presets. O Fixo mostra quanto das contas fixas confirmadas cabe na fatia; o Lazer mostra o gasto do dia a dia do mês contra o teto. Uma fatia só sai do saldo quando você marca "virar compromisso" e liga o plano: aí ela sai no dia em que o salário entra, e o limite diário já desconta. Antes de ligar, "ver se cabe" mostra os próximos 90 dias com e sem o plano, sem gravar nada. Um rascunho que não soma 100% fica salvo como incompleto e não liga.
- **Entradas e saídas.** Ganhos e gastos de um mês (o atual ou um dos 12 anteriores) por conta, por forma de pagamento e por categoria, com os três totais do Início: ganhos, gastos e lazer + investimento. Transferência entre suas próprias contas não conta.
- **Projeção mensal.** Entradas, saídas, plano e sobra de cada mês, para 3, 6 ou 12 meses, separando o que é confirmado do que é estimado.
- **Meu método.** Nove métodos de organizar o dinheiro (50/30/20, equilibrado 35/20/15, base zero, pague-se primeiro, prioridades, limite até a próxima entrada, envelopes, quitação avalanche e bola de neve), cada um com como funciona, quando ajuda, limitações e onde roda no Wall.ia. O Wall.ia sugere dois ou três com o motivo e os números usados, sem nota e sem impor nenhum.
- **Perfil.** Preferência (simples ou detalhado) e objetivo principal, se você quiser dizer, e o histórico dos métodos escolhidos. Entra na exportação e sai na exclusão da conta.

### Fora desta versão
- Registro de investimentos e diário de desenvolvimento pessoal: o Wall.ia cuida do fluxo de caixa. Das duas ideias ficaram as fatias Investimento e Desenvolvimento pessoal e estudo no plano.
- Meta com valor-alvo e data-alvo, e assistente com modelo de linguagem preparando ações (B56, B57).

## 19/11/2026: achados da inspeção da V2 (A3, checkpoint 3)

Bug Hunt e SonarQube na V2, com os mesmos métodos usados no e-wallet.

### Corrigido
- **Pergunta de investimento virava simulação de compra.** "Qual ação devo comprar na bolsa?" casava com "comprar" e o motor pedia o valor. Agora investimento cai em "ainda não sei" antes de qualquer outra intenção; "comprar uma bolsa de 300" continua sendo compra (caso de teste CT-V19).
- **Taxa a partir de `double`.** `LoanCost.monthlyRate` e `OfbResponses.annualRatePercent` usavam `new BigDecimal(double)`, que carrega a expansão binária; agora `BigDecimal.valueOf` (Sonar S2111).
- **Invariante explícita no alerta.** `FutureAlertService` só envia com janela negativa; a garantia estava implícita entre dois métodos (Sonar S2259).

### Revisado sem mudança
- `FieldCipher` (S3077): o `volatile` publica um record imutável com `Map.copyOf`. `EmailVerificationService.maskEmail` (S2259): o nulo retorna antes do `substring`.
- Seis hotspots revisados como seguros: CSRF numa API stateless com JWT; SQL com nome de tabela de constante; regex sobre entrada limitada a 300 caracteres ou sobre configuração; aleatório só no atraso entre tentativas.

## 20/11/2026: identidade visual "Grafite" (substitui a Farol)

A Farol foi recusada na revisão visual com o app rodando: cores, layout e hierarquia, tipografia e acabamento. A direção nova está em [`docs/brand/DESIGN.md`](docs/brand/DESIGN.md).

### Mudou
- **Cor:** quase preto em camadas (`#08090C`, `#0F1116`, `#161920`), ação branca e cor só com significado: projetado/estimado `#8FA3FF`, positivo `#4FD1A1`, negativo `#FF7B7B`, atenção `#F2B85B`. Contraste conferido por `npm run test:contrast` (47 pares).
- **Tipografia:** uma família, Geist, com algarismos tabulares; saem Bricolage, Inter e JetBrains Mono.
- **Hierarquia:** cada tela abre com uma frase-resposta e um número; o gráfico do saldo é o protagonista do Futuro; explicações longas vão para "Por quê?". Listas em linhas com divisória no lugar de cartões.
- **Shell:** menu agrupado (Visão, Dinheiro, Dívidas, Mais) e barra inferior no celular; login sem ilustração de personagem.
- **Marca:** logotipo "Wall.ia" com o ponto da cor de projeção; favicon e `og.png` refeitos.

## 19/11/2026: identidade visual "Farol" (aposentada em 20/11, ver Grafite)

### Mudou
- **Nova identidade.** Sai o preto com verde-limão (ink/volt/horizon); entra o mar à noite com a luz do farol. Fundo azul-esverdeado `#0A1519`, ação em `#FFD25E`, estimado em `#A3B5FF`, positivo `#5ED6A2`, negativo `#FF8590`. Conceito, regras e aplicações em [docs/brand/wallia-brand.md](docs/brand/wallia-brand.md), que o `palette.js` já citava e não existia.
- **Símbolo novo:** um W desenhado como a linha do saldo, sólido até hoje (o ponto de luz) e tracejado depois, com o vale passando abaixo da linha d'água: o buraco entre a fatura e o salário. Favicon, PNG, ICO e `logo.png` regenerados a partir do SVG.
- **Tipografia:** Bricolage Grotesque (tamanho óptico) no lugar da Space Grotesk nos títulos e botões; Inter com algarismos tabulares em todo o corpo. O `overline` deixou de ser caixa-alta espaçada.
- **Certeza também no itálico:** os chips Estimado e Simulado ficam em itálico, além da cor e do estilo da borda.
- Tokens de marca renomeados para o que significam (`brand.lamp`, `brand.fog`, `brand.waterline`).
- Login com a ilustração da linha d'água; `index.html` com descrição nova, Open Graph e `og.png` 1200×630; `theme_color` do manifest atualizado.

### Novo
- `npm run test:contrast`: lê os hex do `palette.js` e confere 53 pares de texto, borda, foco e linha de gráfico (WCAG 2.2). Falha com código 1 se um par cair; provado trocando `muted` por um tom escuro (4 falhas).
- Peças de LinkedIn editáveis em `docs/brand/comunicacao/` (removidas em 20/11 com a Farol) (2 posts 1200×1200 e capa 1584×396), com texto do produto e números só do README. `frontend/scripts/build-icons.py` agora gera ícones, OG e peças com Chrome/Edge headless.

### Limites
- O produto continua só no tema escuro; não existia tema claro.
- `og:image` usa `%PUBLIC_URL%`: para os cartões de compartilhamento funcionarem, o build de produção precisa de `PUBLIC_URL` absoluta.

## 19/11/2026: dado atrasado em toda tela, Pix no crédito e fatura contada uma vez (B50, B14, B12 parcial)

Decisões em [ADR 0020](docs/adr/0020-dado-atrasado-pix-no-credito-e-fatura.md). Migração V34.

### Novo
- **Dado atrasado em toda tela com Open Finance (B50).** Futuro, Início, Radar de cobranças, Compromissos e Análises dizem de qual instituição e de quando é o dado. Quando a última sincronização passa de 36 horas, um alerta aparece antes dos números, com o botão para atualizar.
- **Pix no crédito na quitação (B14).** Em Compromissos, a pessoa informa saldo, parcela e CET ao mês do Pix pago com o limite do cartão. Ele entra na ordem de quitação ao lado dos empréstimos, marcado como "informado por você" e estimado. Não entra na projeção do saldo, porque as parcelas costumam vir na fatura. A seção aparece mesmo sem banco conectado. Entra na exportação e na exclusão da conta.

### Corrigido
- **Pagamento de fatura contado duas vezes (B12, parcial).** Um pagamento de fatura descrito sem a palavra "fatura" (por exemplo "NU PAGAMENTOS SA" ou "PAGTO CARTAO") entrava na média dos gastos do dia a dia, e as mesmas compras já estavam na fatura projetada. Agora o pagamento é reconhecido também pelo valor igual ao total da fatura, até 10 dias do vencimento.
- **Futuro e Radar discordavam sobre dado atrasado.** Conta Open Finance que nunca sincronizou era atrasada no Radar e em dia no Futuro. Agora é atrasada nas duas.

- **Exclusão da conta deixava as decisões do Radar.** `charge_alert_decision` (V33) não estava na limpeza: a conta é pseudonimizada, então o `ON DELETE CASCADE` nunca dispara. Um teste lê as migrações e falha se qualquer tabela com `user_id` ficar de fora.

### Limites
- Pagamento parcial da fatura (só o mínimo) com descrição neutra ainda não é reconhecido.
- A Wall.ia não detecta Pix no crédito sozinha; o sandbox não tem o produto.

## 19/11/2026: preparação para produção (Vercel + Render + Neon)

### Novo
- `render.yaml` (Blueprint): API em Docker no plano free, health check em `/actuator/health/readiness`, segredos com `sync: false`. Na URL pública do Render o actuator expõe só `health` e o Swagger fica desligado.
- `frontend/vercel.json`: rewrite de `/api/*` para a API (mesma origem, sem CORS), fallback da SPA e os cabeçalhos do `nginx.conf`, mais HSTS. `frontend/.env.production` fixa `REACT_APP_API_URL=/api/v1` no build.
- `server.port` lê `PORT` (Render) antes de `backend_port`; o Compose continua com `SERVER_PORT=8080`.
- `.env.production.example` com cada variável da API, sem valores.
- [`docs/deploy-producao.md`](docs/deploy-producao.md): Neon, Blueprint, Vercel, SMTP, IP do cliente, limites dos planos gratuitos e rollback.

### Corrigido
- **Posse da carteira também no serviço.** `transferFunds` e `withdrawFunds` confiavam só no `@PreAuthorize` do controller. Agora o serviço recusa com 403 uma carteira de origem de outro usuário, ou sem ninguém autenticado, antes de mexer em saldo. Os dois testes novos falham sem a checagem.

### Limites
- O plano free do Render bloqueia SMTP nas portas 25, 465 e 587: o e-mail do cadastro precisa da porta alternativa do provedor (Brevo 2525, Resend 2587).
- Pela Vercel, os limites por endereço (cadastro e login) veem o IP do servidor de borda da Vercel, não o do usuário. Continua impossível forjar o IP com `X-Forwarded-For`; o limite por usuário não muda.
- A API dorme após 15 minutos sem uso e os jobs agendados não rodam enquanto ela dorme.

### Verificado
- Backend: 383 testes, 0 falhas, 20 pulados (Testcontainers sem Docker na máquina).
- Frontend: 74 testes, lint sem erros, `CI=true npm run build` ok, com `/api/v1` no bundle e nenhum `localhost:8082`.
- Deploy real não foi feito: Render, Neon e Vercel ficam com o dono.

## 26/10/2026: Radar de cobranças (integrado; validação de mercado pendente)

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
- Integrado à `main` pelo [PR #2](https://github.com/AndreGraccia/Wall.ia/pull/2); CI verde com 381 testes backend, 74 testes frontend e build, além da jornada E2E Playwright aprovada.
- Continua pendente a validação com usuários reais e Open Finance em instituições reais; o sandbox não comprova adoção nem qualidade comercial do diferencial.


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
