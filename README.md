# Mercado Viva — supermercado acadêmico em Python

Projeto completo para Laboratório de Programação 1, com MVC, MPA, Flask/Jinja2, ORM SQLAlchemy e PostgreSQL na Vercel. Professor: Celso Gonsalez Saes.

## Deploy automático na Vercel (sem terminal)

Importe o repositório como Flask, com diretório raiz padrão. Em Settings > Environment Variables, configure:
- DATABASE_URL: URL PostgreSQL do Neon (pooler, com SSL).
- SECRET_KEY: segredo aleatório de pelo menos 32 caracteres.
- APP_ENV: production.
- APP_URL: endereço público do site.
- ADMIN_EMAIL: e-mail do primeiro administrador.
- ADMIN_PASSWORD: frase-senha de 15 a 128 caracteres, com pelo menos 8 caracteres distintos.
- ADMIN_NAME: opcional, padrão Administrador.
- SEED_DEMO: opcional, padrão true; use false para começar sem produtos fictícios.

Use um banco novo e exclusivo para o Mercado Viva. O primeiro acesso cria as tabelas por Alembic, o administrador e, opcionalmente, os produtos fictícios. A inicialização é protegida por uma trava transacional no PostgreSQL. As credenciais não alteram administradores existentes. Após confirmar o primeiro login, remova ADMIN_PASSWORD das variáveis e faça um novo deploy. Não publique segredos no GitHub. Os comandos locais abaixo continuam disponíveis para desenvolvimento.

## Comece aqui

Leia **docs/ROTEIRO_ALUNO.md** para instalação, criação do banco, GitHub, Vercel e domínio; **docs/MANUAL_SISTEMA.md** para operar; **docs/ARQUITETURA.md** para estudar o código; **docs/AVALIACAO_PROFESSOR.md** para validar.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/setup_local.py
python -m alembic upgrade head
python manage.py create-admin
python manage.py create-operator
python manage.py seed
python app.py
```

Abra http://127.0.0.1:5000. Não há credenciais padrão. Os dois comandos de criação de usuário solicitam nome, e-mail e senha no terminal. O banco SQLite local é apenas para aprendizagem individual; para Vercel use PostgreSQL externo conforme o roteiro.

## Módulos entregues

- Login, perfis administrador/operador, hash scrypt, CSRF, bloqueio temporário após falhas, reautenticação, alteração e recuperação de senha.
- Produtos, categorias, fornecedores, ativação/inativação de produtos e operadores.
- Compras com múltiplos itens, recebimento, custo médio ponderado e saída financeira.
- Estoque por produto/categoria, estoque mínimo, ajustes justificados e histórico.
- Caixa por operador, abertura, suprimento, sangria, fechamento, esperado/contado/diferença.
- Carrinho MPA, preço validado no servidor, produtos UN/KG, transação atômica e proteção contra repetição da venda.
- Dinheiro, débito, crédito e Pix simulados; pagamento combinado e troco.
- Cancelamento administrativo com caixa aberto, devolução ao estoque e estorno financeiro.
- Gráfico de barras, relatórios por período, exportação Excel, impressão/PDF pelo navegador e ticket de 80 mm.
- Duas folhas CSS completas: Aurora e Tropical, com o logo IFSP fornecido em public/images/ifsp.png; JavaScript progressivo sem dependência de CDN.
- Migração Alembic, SQL PostgreSQL de referência, carga de 12 produtos e testes automatizados.

## Limites definidos do projeto

É um simulador acadêmico, sem emissão fiscal, TEF, adquirente, banco, Pix real ou integração contábil. Crédito e débito são liquidados imediatamente na simulação, sem parcelas, taxas ou conciliação externa. Compras são recebidas e pagas à vista. Não há contas a pagar/receber parceladas, lotes/validade, múltiplas filiais ou devolução parcial. Produtos inativos preservam o histórico. Não se excluem vendas confirmadas: registra-se cancelamento.

O projeto foi preparado para publicação pelo aluno; nenhuma conta, banco remoto ou URL real é criada apenas ao baixar o ZIP. Senhas, conta GitHub, projeto Neon e conta Vercel são individuais. O plano Hobby destina-se ao uso pessoal não comercial; confirme limites e condições vigentes nos painéis.

## Testes

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

A suíte usa bancos temporários isolados. Consulte docs/VALIDACAO.md para os resultados efetivamente verificados na entrega.
