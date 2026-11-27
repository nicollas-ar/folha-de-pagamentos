"""Inicialização idempotente do PostgreSQL em hospedagem serverless."""
import os
from pathlib import Path
from threading import Lock
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from .models import User, Category, Supplier, Product
from .security import password_policy
from .services.operations import audit, receive_purchase

ROOT = Path(__file__).resolve().parent.parent
_guard = Lock()

def seed_demo(db, admin):
    if db.scalar(select(Product.id).limit(1)):
        return
    cats = {}
    for name in ('Mercearia','Bebidas','Hortifruti','Limpeza','Laticínios'):
        c = db.scalar(select(Category).where(Category.name == name)) or Category(name=name)
        db.add(c)
        db.flush()
        cats[name] = c.id
    name = 'Distribuidora Escola (fictícia)'
    supplier = db.scalar(select(Supplier).where(Supplier.name == name)) or Supplier(name=name, contact='Contato de demonstração')
    db.add(supplier)
    db.flush()
    data = [
        ('1001','Arroz 5 kg','Mercearia','UN','27.90','21.00','30'),
        ('1002','Feijão 1 kg','Mercearia','UN','8.50','5.90','40'),
        ('1003','Café 500 g','Mercearia','UN','19.90','14.00','25'),
        ('1004','Macarrão 500 g','Mercearia','UN','5.20','3.50','50'),
        ('2001','Água mineral 1,5 L','Bebidas','UN','3.50','1.80','60'),
        ('2002','Suco integral 1 L','Bebidas','UN','12.90','8.20','20'),
        ('3001','Banana prata','Hortifruti','KG','6.90','3.80','25'),
        ('3002','Tomate','Hortifruti','KG','8.90','5.00','20'),
        ('4001','Detergente 500 ml','Limpeza','UN','2.90','1.40','50'),
        ('4002','Sabão em pó 1 kg','Limpeza','UN','14.90','10.20','20'),
        ('5001','Leite integral 1 L','Laticínios','UN','5.90','4.00','40'),
        ('5002','Queijo muçarela','Laticínios','KG','44.90','29.00','10'),
    ]
    rows = []
    for sku, name, cat, unit, price, cost, qty in data:
        p = Product(sku=sku,name=name,category_id=cats[cat],unit=unit,price=price,cost=0,stock=0,minimum=5,active=True)
        db.add(p)
        db.flush()
        rows.append((p.id,qty,cost))
    receive_purchase(db,admin,supplier.id,'CARGA-DIDATICA-INICIAL',rows,str(uuid4()))

def ensure_initialized(app):
    if not app.config.get('AUTO_INIT_DB') or app.extensions.get('mercado_initialized'):
        return
    with _guard:
        if app.extensions.get('mercado_initialized'):
            return
        engine = app.extensions['engine']
        if engine.dialect.name != 'postgresql':
            raise RuntimeError('Inicialização automática exige PostgreSQL.')
        with engine.begin() as conn:
            conn.execute(text('SELECT pg_advisory_xact_lock(810270619)'))
            cfg = Config(str(ROOT / 'alembic.ini'))
            cfg.set_main_option('script_location', str(ROOT / 'migrations'))
            cfg.attributes['connection'] = conn
            command.upgrade(cfg, 'head')
            with Session(bind=conn, expire_on_commit=False) as db:
                admin = db.scalar(select(User).where(User.role == 'admin').limit(1))
                if admin is None:
                    email = os.getenv('ADMIN_EMAIL','').strip().lower()
                    password = os.getenv('ADMIN_PASSWORD','')
                    name = os.getenv('ADMIN_NAME','Administrador').strip()
                    if not email or not password:
                        raise RuntimeError('Configure ADMIN_EMAIL e ADMIN_PASSWORD na Vercel.')
                    if len(email)>180 or '@' not in email or '.' not in email.split('@')[-1] or not name or len(name)>100:
                        raise RuntimeError('Dados do administrador inválidos.')
                    admin = User(name=name,email=email,password_hash=password_policy(password),role='admin')
                    db.add(admin)
                    db.flush()
                    audit(db,admin,'Administrador inicial criado automaticamente')
                    if os.getenv('SEED_DEMO','true').lower() in ('true','1','yes'):
                        seed_demo(db,admin)
                    db.flush()
                # O commit da transação externa é feito por engine.begin().
                db.commit()
        app.extensions['mercado_initialized'] = True
