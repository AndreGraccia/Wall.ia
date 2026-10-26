# Wall.ia

Uma carteira que entende seus compromissos, explica de onde cada número veio e deixa você testar o futuro antes de mexer no dinheiro.

React, Spring Boot e PostgreSQL, com Open Finance em sandbox. Nenhum valor real é movimentado.

> Projeto em desenvolvimento. Não use para dinheiro real.

Primeira vez rodando, ou algo não subiu? O [guia do desenvolvedor](docs/guia-do-desenvolvedor.md) explica cada peça, as portas, os erros mais comuns e como criar telas, endpoints e migrações.

## O problema

82% das famílias brasileiras estão endividadas e 29,9% têm contas em atraso (Peic/CNC, ago/2026). O cartão aparece em 84,6% dessas dívidas, e 42,6% das compras no crédito são parceladas: dinheiro que já tem destino nos próximos meses, mas não aparece no saldo.

Os apps de controle financeiro no Brasil mostram, no máximo, o saldo previsto no fim do mês. Quem termina o mês no positivo ainda pode ficar sem dinheiro entre o vencimento da fatura e o salário. É esse buraco que o Wall.ia mostra.

Os números, as fontes e as projeções de negócio (três cenários de 36 meses, teto de CAC) estão em [docs/pesquisa-mercado.md](docs/pesquisa-mercado.md).

## Como funciona

1. **Dados vêm do Open Finance.** Contas, saldos, transações, cartões, faturas, parcelas e empréstimos (sandbox local com estrutura próxima das APIs reais).
2. **O sistema pergunta em vez de supor.** Uma entrada de R$ 4.200 da Concentrix S.A. todo dia 5 vira a pergunta "isso é seu salário?", com o histórico que levou à suspeita. Só o que o usuário confirma entra nas contas.
3. **Java calcula, a IA explica, o usuário decide.** O motor de projeção é determinístico e testado; nenhum valor é inventado por modelo de linguagem. Decisão registrada em [ADR 0001](docs/adr/0001-motor-futuro-deterministico.md) e [ADR 0002](docs/adr/0002-limite-diario-e-perguntas.md).

## Funcionalidades

**Futuro**

- **Limite diário:** quanto dá para gastar por dia até a próxima renda sem nenhum dia negativo, ou quanto falta quando só as contas já não cabem. Com o ritmo do dia a dia confirmado, diz quanto sobra ou quanto cortar por dia.
- **Gastos do dia a dia como pergunta:** a média de mercado, transporte e farmácia dos últimos 90 dias, com a evidência. Só entra na projeção se o usuário confirmar (ou informar o próprio valor). O mesmo vale para as compras à vista no cartão, que entram na fatura em que cada dia cai.
- **Como evitar o negativo:** até três ações calculadas pelo motor (combinar outra data para uma conta, gastar menos por dia, ou quanto falta). Fatura e empréstimo nunca são sugeridos para adiar. Quando a saída é combinar outra data, "Preparar Pix" monta o Pix agendado com destinatário, valor e data, em modo simulação: nada é enviado.
- **Quanto a Wall.ia acertou:** a cada sincronização a previsão fica guardada e, de 7 a 30 dias depois, é comparada com o saldo real. A tela mostra o erro médio, para que lado a previsão tem errado, os negativos evitados e os negativos que ela não viu.
- **Metas:** um valor por mês que entra na projeção como compromisso; o limite diário já desconta. Antes de criar, "Ver se cabe" diz se a meta cria dias negativos em 90 dias.
- **Como cancelar assinaturas:** passos, mensagem pronta e o canal oficial de reclamação, sem comissão.
- **Alertas**, opcionais: um aviso por janela negativa nova, por e-mail e por notificação no navegador (Web Push próprio, sem SDK), mesmo com a Wall.ia fechada. A notificação mostra só a data.
- **Sincronização diária** automática às 7h30, para que alertas e placar usem o saldo do dia.
- Saldo agora, quanto já tem destino (separando confirmado de estimado) e margem livre.
- Saldo projetado dia a dia em 30, 60 ou 90 dias, com o menor saldo marcado.
- Alerta de janela negativa ("entre 03/10 e 04/10 seu saldo pode ficar em -R$ 324,87") e "ver por quê", que lista as contas que causam o buraco e a entrada que o fecha, com o custo estimado do cheque especial no período: juros pela taxa média do seu banco publicada pelo Banco Central (ou a mediana dos bancos), nunca acima do teto legal de 8% ao mês, mais IOF, com a fonte e a data da taxa.
- Perguntas rápidas sobre recorrências detectadas, com evidência (valor, dia, vezes, conta de origem) e resposta em um toque.
- Modo Futuro: simula compra à vista ou parcelada, guardar todo mês ou perder uma renda, sem gravar nada.

**Envelopes**

- Separe parte do saldo para o que a projeção não conhece (viagem, IPVA, reserva). O dinheiro não se move; o limite diário passa a ser o que dá para gastar sem mexer nos envelopes. Substitui a antiga tela Movimentar.

**Pergunte à Wall.ia**

- "Posso comprar um notebook de R$ 4.000 em 10x?", "Quanto posso gastar por dia?", "Por que meu saldo fica negativo?". A resposta vem do motor, com os números e a origem. Nenhum modelo de linguagem define valores, e pergunta fora do que o motor sabe responder recebe "ainda não sei".

**Radar de cobranças**

- Identifica padrões mensais mesmo quando o preço varia, destaca aumentos observados a partir da mediana histórica e sinaliza lançamentos de mesmo nome, valor e data como possíveis duplicidades.
- Mostra a evidência do extrato, a próxima data provável e avisa quando os dados conectados estão antigos. A pessoa revisa; o radar não acusa fraude, cancela serviços nem movimenta dinheiro.
- Tela autenticada em /billing-radar; API GET /api/v1/billing-radar. Decisão e limites em [ADR 0019](docs/adr/0019-radar-de-cobrancas.md) e validação em [documentação de evolução](docs/evolucao-radar-cobrancas.md).

**Cartões e dívidas**

- Fatura aberta e faturas futuras com as compras e parcelas que as compõem.
- Limite comprometido.
- Empréstimos: quanto falta, parcela, parcelas restantes, próximo vencimento, CET e instituição de origem.
- Pagamento mínimo da fatura, com o aviso de que o resto vai para o rotativo e a taxa do rotativo no Banco Central.
- Taxa do contrato comparada com a mediana do crédito pessoal no Banco Central, e CDI, Selic e IPCA do dia.
- **Quanto este dinheiro custa:** quanto da próxima parcela é juro e quanto de juros ainda falta pagar até o fim.

**Base da carteira**

- Cadastro e login com JWT (usuário sem diferenciar maiúsculas, ou e-mail), limite de tentativas e de cadastros.
- Trilha de auditoria de todo acesso administrativo, inclusive tentativas negadas.
- Painel de métricas para admin: negativos evitados por usuário ativo por mês (a métrica principal), negativos sem aviso, perguntas sem resposta e interesse no Pix.
- Carteiras e extrato, com autorização por dono da carteira.
- E-mail confirmado no cadastro por código de 8 dígitos ([roteiro de teste](docs/open-finance-email-tests.md)); sem ele, o login não entra. "Sair de todos os dispositivos" invalida todos os tokens emitidos.
- Open Finance na jornada de consentimento do padrão brasileiro: prazo de 3, 6 ou 12 meses, tela da instituição (simulada no sandbox), autorizar ou recusar, sincronizar e revogar. Revogar apaga o que foi importado.
- Análise do extrato com regras locais ou Gemini, sem enviar o extrato bruto ([segurança e IA](docs/security-and-ai-reports.md)).
- Interface em português e inglês, tema escuro, responsiva, validada em 1440 px e 390 px.
- Swagger em `/swagger-ui/index.html`.

## Próximos passos

A análise completa (diagnóstico, oportunidades avaliadas, o que não fazer e por quê, decisões em aberto e métricas) está em [docs/estrategia-produto.md](docs/estrategia-produto.md). Decisões técnicas nos ADRs [0001](docs/adr/0001-motor-futuro-deterministico.md), [0002](docs/adr/0002-limite-diario-e-perguntas.md), [0003](docs/adr/0003-saida-do-buraco-metas-e-alertas.md), [0004](docs/adr/0004-auditoria-admin-e-ledger.md) [0005](docs/adr/0005-envelopes-placar-e-pix-simulado.md), [0006](docs/adr/0006-sync-diario-e-push-sem-sdk.md), [0007](docs/adr/0007-dia-util-e-datas-de-borda.md), [0008](docs/adr/0008-email-no-cadastro-e-consentimento-ofb.md), [0009](docs/adr/0009-aderencia-open-finance-brasil.md) e [0010](docs/adr/0010-dados-publicos-do-banco-central.md). O que mudou em cada versão está no [CHANGELOG](CHANGELOG.md).

Em aberto, para o dono do produto decidir: credenciar a iniciação de pagamento pelo Open Finance, que tiraria o Pix do modo simulação e é também o gatilho do ledger de dupla entrada.

## Tecnologias

### Backend

- Java 25 (LTS)
- Spring Boot 4.1
- Spring Web
- Spring Security
- JWT
- Spring Data JPA
- Hibernate
- PostgreSQL
- Flyway
- MapStruct
- Jakarta Validation
- Maven
- JUnit 5
- Mockito
- Springdoc OpenAPI

### Frontend

- React
- React Router
- Material UI
- Axios
- React Hook Form
- Notistack
- i18next (PT/EN)
- Node.js
- npm

### Infraestrutura

- Docker
- Docker Compose
- PostgreSQL
- Mailpit (caixa de e-mail local para o código de 8 dígitos)

## Estrutura do projeto

```text
Carteira-Digital/
├── backend/
│   ├── src/main/java/
│   │   └── com/github/yildizmy/
│   │       ├── config/
│   │       ├── controller/
│   │       ├── domain/
│   │       ├── dto/
│   │       ├── exception/
│   │       ├── repository/
│   │       ├── security/
│   │       ├── service/
│   │       │   ├── future/        # motor de projeção (sem Spring)
│   │       │   └── openfinance/   # sandbox e gateway
│   │       └── validator/
│   └── src/main/resources/
│       ├── db/migration/
│       └── application.yml
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── layouts/
│       ├── pages/             # future/, commitments/, open-finance/...
│       ├── services/
│       └── theme/
├── docs/                      # guia do desenvolvedor, estratégia, pesquisa, ADRs, roteiros de teste
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example.properties
└── README.md
```

## Pré-requisitos

Antes de iniciar, instale:

- Git
- JDK 25 (o Maven vem pelo wrapper `mvnw`). No Windows: `winget install EclipseAdoptium.Temurin.25.JDK`
- Node.js LTS com npm
- Docker Desktop

Confira as instalações:

```powershell
git --version
java -version
node --version
npm.cmd --version
docker --version
```

## Configuração inicial

Clone o repositório:

```powershell
git clone https://github.com/AndreGraccia/Carteira-Digital.git
cd Carteira-Digital
```

Crie o arquivo local de configuração:

```powershell
Copy-Item .env.example.properties .env.properties
```

Abra o arquivo:

```powershell
notepad .env.properties
```

Configure os valores locais:

```properties
db_name=wallia
db_username=wallia
db_password=SUBSTITUA_PELA_SENHA_LOCAL
jwt_secret=SUBSTITUA_POR_UM_SEGREDO_ALEATORIO
frontend_origin=http://localhost:3001
gemini_api_key=
gemini_model=gemini-3.8-flash
gemini_search_grounding=true
db_port=5432
backend_port=8082
frontend_port=3001
```

Os padrões 8082 e 3001 evitam as portas 8080 e 3000, que outros projetos costumam ocupar. Se alguma porta estiver em uso, troque também `frontend_origin` e crie `frontend/.env.local` a partir de `frontend/.env.example`. O passo a passo está na [seção de portas do guia](docs/guia-do-desenvolvedor.md#4-portas-conferir-e-trocar).

Troque `db_password` antes de subir o banco pela primeira vez: o PostgreSQL grava a senha só na criação do volume.

Para gerar um segredo JWT no PowerShell:

```powershell
$bytes = New-Object byte[] 64
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

Copie o resultado para `jwt_secret`.

O arquivo `.env.properties` contém informações locais e está ignorado pelo Git. Nunca publique esse arquivo.

`gemini_api_key` é opcional. Com o campo vazio, a tela **Análise** continua funcionando com regras locais determinísticas. Para habilitar a Gemini, crie uma chave no Google AI Studio, salve-a somente nesse arquivo e reinicie o backend. A chave nunca deve usar o prefixo `REACT_APP_` nem ser colocada no frontend.

O relatório envia apenas totais mensais, direção das operações e contagem de movimentações. Nomes, e-mails, códigos de carteira, descrições e identificadores não são enviados. Consulte [segurança e relatórios com IA](docs/security-and-ai-reports.md) para entender o fluxo, os limites e as referências.

## Executando o PostgreSQL e o Mailpit

Abra o Docker Desktop e aguarde o mecanismo iniciar.

Na raiz do projeto, abra o primeiro PowerShell e execute:

```powershell
docker compose --env-file .env.properties up -d db mailpit
```

O Mailpit recebe o código de confirmação do Open Finance em http://localhost:8025. Nenhum e-mail sai da máquina.

Confira o container:

```powershell
docker compose --env-file .env.properties ps
```

Teste a disponibilidade do banco:

```powershell
docker compose --env-file .env.properties exec db sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

O resultado esperado deve conter:

```text
accepting connections
```

## Executando o backend

Abra um segundo PowerShell, entre na pasta do backend e inicie o Spring Boot:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Se você já iniciou `WalliaApplication` pelo VS Code, pule esse comando. Apenas uma instância pode usar a porta `8082` (ou a `backend_port`) ao mesmo tempo.

Aguarde a linha `Started WalliaApplication`. Se o processo parar antes disso, veja [Problemas comuns](docs/guia-do-desenvolvedor.md#problemas-comuns).

O backend estará disponível em:

```text
http://localhost:8082
```

A documentação Swagger estará disponível em:

```text
http://localhost:8082/swagger-ui/index.html
```

Mantenha esse terminal aberto enquanto estiver usando a aplicação.

## Executando o frontend

Abra um terceiro PowerShell a partir da raiz do projeto e entre na pasta do frontend:

```powershell
cd frontend
```

Instale as dependências:

```powershell
npm.cmd install
```

Inicie a aplicação:

```powershell
npm.cmd start
```

A interface estará disponível em:

```text
http://localhost:3001
```

Mantenha esse terminal aberto enquanto estiver usando a aplicação.

## Executando tudo com Docker

Como alternativa aos três terminais, execute na raiz do projeto:

```powershell
docker compose --env-file .env.properties -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Esse comando inicia PostgreSQL, Mailpit, backend e frontend. Não mantenha as versões locais nas portas `3001` e `8082` enquanto executar a pilha completa em containers.

## Encerrando a aplicação

Para encerrar o frontend ou o backend, pressione:

```text
Ctrl + C
```

Para parar o PostgreSQL preservando os dados:

```powershell
docker compose --env-file .env.properties stop db
```

Para remover os containers preservando o volume do banco:

```powershell
docker compose --env-file .env.properties down
```

## Executando os testes

Testes do backend (a partir da raiz):

```powershell
cd backend
.\mvnw.cmd test
```

Testes do frontend (a partir da raiz):

```powershell
cd frontend
npm.cmd test -- --watchAll=false
npm.cmd run test:i18n
npm.cmd run test:wallet
npm.cmd run lint
```

## Segurança

As seguintes regras devem ser observadas durante o desenvolvimento:

- Nunca publicar `.env.properties`.
- Nunca colocar senhas ou chaves de API diretamente no código.
- Manter chaves do Gemini ou OpenAI somente no backend.
- Validar o usuário autenticado em todas as consultas.
- Impedir o acesso a carteiras pertencentes a outros usuários.
- Não permitir que a inteligência artificial execute movimentações financeiras.
- Não enviar dados pessoais desnecessários para provedores externos.
- Não exibir tokens JWT no console ou em capturas de tela.
- Revisar dependências e configurações antes de publicar uma versão.

## Fluxo de colaboração

Crie uma branch para cada alteração:

```powershell
git switch main
git pull origin main
git switch -c feat/nome-da-funcionalidade
```

Exemplos de nomes:

```text
feat/dashboard-real
feat/relatorios
feat/assistente-ia
fix/autorizacao-carteira
fix/login
docs/configuracao-local
```

Depois das alterações:

```powershell
git status
git add .
git commit -m "feat: descreva a alteração"
git push -u origin feat/nome-da-funcionalidade
```

Abra um Pull Request no GitHub para revisão antes de juntar a alteração à branch `main`.

## Padrão de commits

Exemplos:

```text
feat: adiciona resumo financeiro ao painel
fix: corrige armazenamento do token de login
docs: atualiza instruções de execução
test: adiciona testes de autorização
refactor: reorganiza serviço de transações
chore: atualiza configuração do projeto
```

## Projeto original

Este projeto é uma evolução de [yildizmy/e-wallet](https://github.com/yildizmy/e-wallet), criado por Murat Yıldız e disponibilizado sob a licença MIT.

A licença e os créditos do projeto original são preservados no arquivo [LICENSE](LICENSE).

## Licença

Este projeto é distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE) para conhecer os termos.
