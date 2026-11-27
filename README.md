# Folha Clara — sistema didático de folha de pagamento

Aplicação web em Python/Flask e PostgreSQL para demonstrar autorização por papéis (RBAC), atributos (ABAC) e relacionamentos (ReBAC). O sistema inclui cadastro de funcionários e contas vinculadas, autenticação, troca obrigatória de senha inicial, lançamentos, cálculo demonstrativo, aprovação por gestor, fechamento por RH e consulta de demonstrativo.

## Requisitos

- Python 3.10 ou superior
- Debian/Linux ou outro ambiente com Python e `venv`
- Acesso ao índice de pacotes Python para instalar as dependências
- Banco PostgreSQL (por exemplo, Neon); não exige Java

## Instalação

No terminal, entre na pasta `folha_pagamento` e execute:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Defina uma chave de sessão para o ambiente local, crie contas de exemplo e inicie o servidor:

```bash
export DATABASE_URL="postgresql://usuario:senha@host/neondb?sslmode=require"
export FLASK_SECRET_KEY="substitua-por-uma-chave-aleatoria-longa"
python seed.py
python app.py
```

Abra `http://127.0.0.1:5000`. O comando `seed.py` mostra senhas temporárias aleatórias uma única vez; guarde-as e troque-as no primeiro acesso. O comando inicializa as tabelas no PostgreSQL indicado por `DATABASE_URL`. Para criar somente as tabelas, execute `python -m flask --app app init-db`.

Para uma instância HTTPS, defina também `COOKIE_SECURE=1`. Não use a chave de exemplo nem as contas de demonstração em produção.

## Perfis e regras de autorização

- **Administrador:** acesso administrativo do sistema.
- **RH:** consulta funcionários e salários, cria lançamentos e fecha folhas aprovadas.
- **Gestor:** consulta funcionários do próprio departamento e aprova rascunhos do departamento; valores salariais ficam ocultos.
- **Funcionário:** consulta somente demonstrativos próprios que estejam fechados.

As regras estão em `access.py`. O código aplica negação por padrão, verifica a conta ativa e usa nível de acesso para recursos sensíveis. A relação com o departamento e com o funcionário dono do registro decide o acesso específico.

## Cálculo didático

```text
Horas extras = horas informadas × valor informado por hora
Remuneração bruta = salário-base + horas extras + bonificação + outros proventos
Valor líquido = remuneração bruta − descontos informados
```

O sistema não calcula automaticamente INSS, IRRF, FGTS, encargos, férias, décimo terceiro ou regras legais. Os resultados são fictícios para fins de aula e não devem ser usados para pagar funcionários ou gerar documentos oficiais.

## Estrutura

```text
folha_pagamento/
├── app.py
├── access.py
├── db.py
├── payroll.py
├── seed.py
├── requirements.txt
├── README.md
├── static/css/app.css
└── templates/
    ├── base.html
    ├── change_password.html
    ├── dashboard.html
    ├── employee_form.html
    ├── employees.html
    ├── error.html
    ├── login.html
    ├── payroll.html
    ├── payroll_form.html
    └── payslip.html
```

Java não é necessário neste projeto: o back-end solicitado está implementado em Python/Flask. O PostgreSQL é acessado pelo Psycopg 3.

## Deploy no Vercel + Neon

1. Crie um projeto PostgreSQL no Neon e copie a URL de conexão com pooling.
2. No Vercel, importe o repositório (preset Flask, raiz `./`) e configure `DATABASE_URL`, `FLASK_SECRET_KEY` (chave aleatória persistente) e `COOKIE_SECURE=1`.
3. No computador local, instale as dependências e configure a mesma `DATABASE_URL` em uma variável de ambiente privada. Execute `python seed.py` uma vez para criar as contas fictícias e anote as senhas temporárias. Não execute em um banco real.
4. Faça o deploy/redeploy. O app não cria arquivos locais nem executa DDL durante a inicialização do servidor.

O banco SQLite antigo não é migrado automaticamente. Não publique credenciais nem dados reais neste projeto didático.
