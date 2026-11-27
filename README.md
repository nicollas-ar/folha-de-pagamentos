# Folha Clara — sistema didático de folha de pagamento

Aplicação web em Python/Flask e SQLite para demonstrar autorização por papéis (RBAC), atributos (ABAC) e relacionamentos (ReBAC). O sistema inclui cadastro de funcionários e contas vinculadas, autenticação, troca obrigatória de senha inicial, lançamentos, cálculo demonstrativo, aprovação por gestor, fechamento por RH e consulta de demonstrativo.

## Requisitos

- Python 3.10 ou superior
- Debian/Linux ou outro ambiente com Python e `venv`
- Acesso ao índice de pacotes Python para instalar as dependências
- Não exige `sudo`, servidor de banco ou Java

## Instalação

No terminal, entre na pasta `folha_pagamento` e execute:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Defina uma chave de sessão para o ambiente local, crie contas de exemplo e inicie o servidor:

```bash
export FLASK_SECRET_KEY="substitua-por-uma-chave-aleatoria-longa"
python seed.py
python app.py
```

Abra `http://127.0.0.1:5000`. O comando `seed.py` mostra senhas temporárias aleatórias uma única vez; guarde-as e troque-as no primeiro acesso. O banco é criado em `instance/folha.db`. Para usar outro caminho, defina `PAYROLL_DATABASE`.

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
├── instance/                 # banco SQLite criado na primeira execução
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

Java não é necessário neste projeto: o back-end solicitado está implementado em Python/Flask. O SQLite é acessado pela biblioteca padrão `sqlite3`.
