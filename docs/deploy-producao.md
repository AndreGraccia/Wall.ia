# Deploy em produção: Vercel + Render + Neon

Roteiro para subir a Wall.ia nos planos gratuitos: frontend na Vercel, API no Render (Docker) e PostgreSQL no Neon. A pilha com Docker Compose num servidor próprio continua valendo e está em [`operacao.md`](operacao.md).

```
navegador ──https──> Vercel (site estático)
                       └─ /api/* ──rewrite──> Render (API Spring Boot) ──TLS──> Neon (PostgreSQL)
```

O navegador só conversa com a Vercel. O `vercel.json` repassa `/api/*` para a API, então o site e a API ficam na mesma origem: sem CORS no caminho normal e com a mesma CSP do `nginx.conf` (`connect-src 'self'`).

Arquivos envolvidos:

| Arquivo | Papel |
| --- | --- |
| `render.yaml` | Blueprint do serviço da API no Render |
| `frontend/vercel.json` | Rewrite de `/api`, fallback da SPA e cabeçalhos de segurança |
| `frontend/.env.production` | `REACT_APP_API_URL=/api/v1` no build |
| `.env.production.example` | Lista de variáveis da API, sem valores |

## Caminho curto (27/11/2026)

O frontend já está publicado em https://wallia-eight.vercel.app. Falta a API:

1. Crie uma conta num provedor de e-mail transacional (Brevo, porta 2525, ou Resend, porta 2587) e uma chave SMTP.
2. Abra https://render.com/deploy?repo=https://github.com/AndreGraccia/Wall.ia/tree/chore/publicacao (depois do merge, use a branch `main`) e entre com o GitHub.
3. O Render pede só os cinco valores de e-mail. Ele cria o banco, gera `JWT_SECRET` e `DATA_ENCRYPTION_KEY` e liga tudo. Clique em **Apply**.
4. Se o serviço ganhar um endereço diferente de `https://wallia-api.onrender.com`, troque o destino em `frontend/vercel.json` e publique o frontend de novo.

Limites do plano gratuito: o banco expira em 30 dias e não tem backup; a API dorme sem uso e leva cerca de um minuto para acordar. Serve para demonstração, não para dados financeiros reais. As seções abaixo descrevem a montagem manual com o Neon.

## 0. Antes de começar

- Contas: Neon, Render, Vercel e um provedor de e-mail transacional (seção 4). Todas logando com o GitHub facilitam.
- Gere os dois segredos na sua máquina e guarde num gerenciador de senhas. Não cole em chat, issue nem commit.

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 32   # DATA_ENCRYPTION_KEY
```

A `DATA_ENCRYPTION_KEY` cifra as descrições dos lançamentos (ADR 0014). Perdeu a chave, perdeu as descrições. Trocar exige a rotação do ADR 0016 ([`operacao.md`](operacao.md), seção 3).

## 1. Banco no Neon

1. Crie um projeto. Região: **AWS US East (N. Virginia)**, a mesma do Render no `render.yaml`. Banco e API em regiões diferentes somam latência a cada consulta.
2. Em **Connect**, desligue **Connection pooling** e copie a connection string. Ela vem assim:
   `postgresql://USUARIO:SENHA@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Separe em três valores para o Render:
   - `SPRING_DATASOURCE_URL` = `jdbc:postgresql://ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - `SPRING_DATASOURCE_USERNAME` = `USUARIO`
   - `SPRING_DATASOURCE_PASSWORD` = `SENHA`

Por que sem pooling: o endpoint `-pooler` é PgBouncer em modo transação, que não combina com o Flyway nem com os prepared statements do driver JDBC. A API já tem o próprio pool (Hikari, limitado a 5 conexões no `render.yaml`).

O `sslmode=require` é obrigatório: o Neon recusa conexão sem TLS.

As tabelas não são criadas à mão. O Flyway roda na subida da API e aplica V1 até a última migração num banco vazio.

**Já tem dados no Postgres local?** `pg_dump -Fc` do banco antigo e `pg_restore --no-owner -d "<connection string do Neon>"` antes do primeiro deploy, com a mesma `DATA_ENCRYPTION_KEY` de antes. Rode antes as consultas de duplicata da V19 ([guia](guia-do-desenvolvedor.md), "Antes de subir para produção").

## 2. API no Render

1. **New → Blueprint**, escolha o repositório. O Render lê o `render.yaml` da raiz e propõe o serviço `wallia-api`.
2. Ele pede cada variável marcada com `sync: false`. Preencha:

| Variável | Valor |
| --- | --- |
| `SPRING_DATASOURCE_URL`, `_USERNAME`, `_PASSWORD` | Seção 1 |
| `JWT_SECRET` | Gerado na seção 0 |
| `DATA_ENCRYPTION_KEY` | Gerado na seção 0 |
| `FRONTEND_ORIGIN` | URL da Vercel, ex. `https://wallia.vercel.app`, sem barra no fim. Ainda não tem? Coloque um valor provisório e corrija na seção 3 |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | Seção 4 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Opcional. Vazio desliga o push. Gerar: [guia](guia-do-desenvolvedor.md), "Avisos no navegador" |
| `GEMINI_API_KEY` | Opcional. Vazio usa a análise local |

3. **Apply**. O primeiro build demora (Maven baixa as dependências dentro do Docker). O deploy só é dado como pronto quando `/actuator/health/readiness` responde `UP`, e isso inclui o banco.
4. Anote a URL do serviço, normalmente `https://wallia-api.onrender.com`. Se o nome já estiver em uso, o Render acrescenta um sufixo. Nesse caso troque o destino em `frontend/vercel.json` (seção 3) por PR.

O que o `render.yaml` já fixa e não precisa mexer:

- `PORT` vem do Render; o `application.yml` lê `${PORT}` antes do `backend_port`. O Compose continua usando `SERVER_PORT=8080`, que tem prioridade.
- Actuator expõe só `health`. A URL `onrender.com` é pública, ao contrário da pilha Docker em que o nginx não repassa `/actuator`; o `/actuator/prometheus` ficaria aberto para qualquer um.
- Swagger e `/v3/api-docs` desligados.
- Log em JSON (ECS), uma linha por evento, visível em **Logs** no painel.
- `JAVA_TOOL_OPTIONS` com heap em 70% dos 512 MB. Se aparecer `OutOfMemoryError` nos logs, o plano free não comporta a carga e é hora do plano pago.

Teste:

```bash
curl -s https://wallia-api.onrender.com/actuator/health/readiness
# {"status":"UP"}
curl -s -o /dev/null -w "%{http_code}\n" https://wallia-api.onrender.com/actuator/prometheus
# 404: métricas fora do ar (qualquer resposta sem métricas serve)
```

## 3. Frontend na Vercel

1. **Add New → Project**, importe o repositório.
2. **Root Directory: `frontend`**. O preset Create React App é detectado; o `vercel.json` já define `npm run build` e a pasta `build`.
3. Nenhuma variável de ambiente. O `frontend/.env.production` já faz o build chamar `/api/v1`, caminho relativo.
4. **Deploy**. Anote a URL de produção (ex. `https://wallia.vercel.app`).
5. Volte no Render, ajuste `FRONTEND_ORIGIN` para essa URL exata e salve (o Render reinicia a API).

Por que `FRONTEND_ORIGIN` importa mesmo sem CORS: o navegador manda `Origin: https://wallia.vercel.app` em todo POST, a Vercel repassa, e a API chega a ver um Origin diferente do próprio host (`onrender.com`). O Spring trata isso como chamada de outra origem e só aceita a que está em `FRONTEND_ORIGIN`. Errou o valor, todo cadastro e login dá 403.

Deploys de preview da Vercel têm outra URL e, por isso, os POSTs deles dão 403. É esperado: preview serve para ver tela, não para usar a API de produção.

Teste o caminho inteiro:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://wallia.vercel.app/
# 200
curl -s -o /dev/null -w "%{http_code}\n" https://wallia.vercel.app/login
# 200 (fallback da SPA para index.html)
curl -s -i https://wallia.vercel.app/api/v1/wallets/1 | head -1
# HTTP/2 401  -> o rewrite chegou na API e ela pediu login
curl -s -I https://wallia.vercel.app/ | grep -i -E "content-security|strict-transport|x-frame"
```

Depois, no navegador: criar conta, receber o código de 8 dígitos, confirmar, entrar.

## 4. E-mail do cadastro

Sem SMTP de verdade ninguém conclui o cadastro: o código de 8 dígitos vai por e-mail. Tudo é configurado por variável (`MAIL_*`); a escolha do provedor é sua. Duas opções com plano gratuito:

| | Brevo | Resend |
| --- | --- | --- |
| `MAIL_HOST` | `smtp-relay.brevo.com` | `smtp.resend.com` |
| `MAIL_PORT` | `2525` | `2587` |
| `MAIL_USERNAME` | Login SMTP mostrado no painel (não é o seu e-mail) | `resend` |
| `MAIL_PASSWORD` | Chave SMTP (não a API key) | API key |
| Documentação | [developers.brevo.com/docs/smtp-integration](https://developers.brevo.com/docs/smtp-integration) | [resend.com/docs/send-with-smtp](https://resend.com/docs/send-with-smtp) |

Confira o limite diário de envio do plano gratuito na página de preços de cada um antes de decidir.

**Porta 587 não funciona no Render free.** Desde setembro de 2025 o plano gratuito bloqueia a saída nas portas 25, 465 e 587 ([changelog do Render](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports)). As portas 2525 (Brevo) e 2587 (Resend) usam STARTTLS, que é o que `MAIL_STARTTLS=true` liga. Porta 465/2465 (TLS implícito) não é suportada pela configuração atual.

`MAIL_FROM` precisa ser de um domínio verificado no provedor (SPF e DKIM no DNS). Sem domínio próprio, o envio é recusado ou vai para o spam.

Se o código não chegar: **Logs** do Render, procure por `mail` ou `MailSendException`. Timeout de conexão quase sempre é porta bloqueada; `535 Authentication failed`, usuário ou senha.

## 5. IP do cliente e limites por endereço

Cadastro (10 por hora) e login (5 erros em 15 minutos) têm limite por endereço, contado em `AuthenticationRateLimiter` a partir de `request.getRemoteAddr()`. Com `server.forward-headers-strategy: native`, o Tomcat preenche esse endereço a partir do `X-Forwarded-For`, lendo da direita para a esquerda e parando no primeiro IP que não é de rede privada. O IP público mais à direita foi anotado pelo proxy do Render, não pelo cliente, então um `X-Forwarded-For` forjado no começo da lista é ignorado. Isso vale também para quem chama `onrender.com` direto, pulando a Vercel.

O preço dessa segurança: chamando pela Vercel, o endereço que a API vê é o do servidor da Vercel que fez o rewrite, não o do usuário. Na prática:

- O limite de **login por usuário** (20 em 15 minutos, de qualquer IP) continua valendo como está.
- Os limites **por endereço** passam a ser por servidor de borda da Vercel. Muita gente atrás do mesmo servidor de borda divide a cota de 10 cadastros por hora. Com pouco tráfego não aparece; com abuso, um atacante pode atrasar cadastros legítimos.
- Os contadores ficam em memória e zeram quando o serviço dorme ou reinicia.

Confiar no `X-Forwarded-For` que a Vercel manda daria o IP real, mas qualquer um poderia forjar esse cabeçalho chamando `onrender.com` direto, porque a Vercel não tem faixa de IP fixa para liberar. Corrigir de verdade pede um segredo compartilhado entre Vercel e API (middleware na Vercel) ou domínio próprio com proxy que só aceite a Vercel. Fica para quando houver tráfego que justifique.

Como o Render monta o `X-Forwarded-For` não está documentado por ele; o comportamento acima vem de relatos da comunidade. Confirme depois da subida, chamando `onrender.com` direto:

```bash
# 6 logins errados com um X-Forwarded-For diferente a cada vez. Seguro: o 6º dá 429.
# Se todos derem 401, o cabeçalho forjado está sendo aceito: pare e revise antes de abrir para usuários.
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://wallia-api.onrender.com/api/v1/auth/login \
    -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.$i" \
    -d '{"username":"teste-limite","password":"errada"}'
done
```

Se o Render um dia chegar à API com IP público (fora das faixas privadas que o Tomcat confia), todos os usuários teriam o mesmo endereço. Dá para ajustar quem é proxy confiável por variável, sem código: `SERVER_TOMCAT_REMOTEIP_INTERNALPROXIES` (expressão regular de IPs).

## 6. Limites dos planos gratuitos

Valores do momento em que este guia foi escrito. Confira a página de preços de cada serviço antes de depender deles.

**Render free**
- **Dorme depois de 15 minutos sem requisição.** A primeira chamada depois disso acorda o serviço, e uma API Spring Boot leva de um a alguns minutos para subir com 0,1 CPU. O frontend desiste em 15 segundos (`timeout` do axios), então o primeiro login depois de um tempo parado falha e o segundo funciona.
- **Jobs agendados não rodam com o serviço dormindo**: alerta das 8h, sincronização do Open Finance às 7h30, limpeza das 3h30, rotação de chave, cotações do Banco Central. Eles rodam quando o serviço estiver acordado no horário.
- Saída SMTP bloqueada nas portas 25, 465 e 587 (seção 4).
- 512 MB de RAM, disco efêmero (o arquivo `logs/application.log` some a cada deploy; use os Logs do painel), 750 horas de instância por mês na conta.
- Paliativo para o sono: um monitor externo (UptimeRobot, por exemplo) chamando `/actuator/health/liveness` a cada 10 minutos. Um serviço acordado o mês inteiro gasta cerca de 744 das 750 horas.

**Neon free**
- O banco suspende depois de alguns minutos parado; a primeira consulta seguinte leva algumas centenas de milissegundos a mais. A readiness do Render cobre isso.
- Armazenamento e horas de computação limitados por projeto. Acompanhe em **Usage** no painel.
- Janela curta de restauração no tempo (point-in-time restore). Não substitui backup: faça `pg_dump` periódico para fora do Neon, como na seção 2 de [`operacao.md`](operacao.md).

**Vercel Hobby**
- **Só para uso pessoal e não comercial.** Se a Wall.ia cobrar ou for produto de empresa, os termos exigem o plano Pro.
- O site é estático; os limites de banda do Hobby sobram para esse tamanho.

## 7. Atualizar e voltar atrás

Atualizar: merge do PR na `main`. Render e Vercel fazem deploy sozinhos a partir do push na branch ligada a cada serviço.

**Rollback da API**: Render → serviço → **Events** → deploy anterior → **Rollback**. O Flyway só anda para frente: o rollback do código não desfaz migração. Por isso as migrações do projeto são aditivas (coluna nova nullable ou com default); o código anterior continua funcionando com o esquema novo. Uma migração destrutiva exige plano próprio antes do merge.

**Rollback do frontend**: Vercel → **Deployments** → deploy anterior → **Instant Rollback** (ou **Promote to Production**).

**Rollback do banco**: Neon → **Restore** para um instante anterior, dentro da janela do plano, ou `pg_restore` do último dump. Restaurar o banco perde o que foi gravado depois do ponto escolhido; avise os usuários.

**Segredo vazado**: troque no Render (Environment) e salve; o serviço reinicia. `JWT_SECRET` novo desloga todo mundo. `DATA_ENCRYPTION_KEY` segue a rotação do ADR 0016, nunca troca direta. Roteiro completo em [`operacao.md`](operacao.md), seção 4.

## 8. Checklist da primeira subida

- [ ] Neon criado em us-east-1, connection string sem pooling
- [ ] `JWT_SECRET` e `DATA_ENCRYPTION_KEY` gerados e guardados fora do repositório
- [ ] Provedor de e-mail com domínio verificado e porta alternativa (2525 ou 2587)
- [ ] Blueprint aplicado, readiness `UP`, `/actuator/prometheus` sem métricas
- [ ] Vercel com Root Directory `frontend`, destino do rewrite igual à URL do Render
- [ ] `FRONTEND_ORIGIN` igual à URL de produção da Vercel
- [ ] `/api/v1/wallets/1` pela Vercel responde 401
- [ ] Cadastro completo com código recebido por e-mail
- [ ] Administrador criado ([guia](guia-do-desenvolvedor.md), "Ter um administrador")
