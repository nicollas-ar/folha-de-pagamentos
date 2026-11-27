"""Cria contas de demonstração com senhas temporárias aleatórias."""
import secrets

from argon2 import PasswordHasher

from app import app
from db import get_db


def main():
    hasher = PasswordHasher()
    with app.app_context():
        db = get_db()
        if db.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]:
            print("Já existem contas. Nenhuma conta de demonstração foi criada.")
            return

        departments = ["Tecnologia", "Administração"]
        people = [
            ("E001", "Ana Funcionária", "ana@example.test", departments[0], "Analista", 4500, "ana", "funcionario", 3),
            ("E002", "Bruno Gestor", "bruno@example.test", departments[0], "Coordenador", 7000, "bruno", "gestor", 2),
            ("E003", "Carla RH", "carla@example.test", departments[1], "Analista de RH", 5200, "carla", "rh", 3),
        ]
        credentials = []
        for code, name, email, department, title, salary, username, role, clearance in people:
            cursor = db.execute(
                """INSERT INTO employees(code, full_name, email, department, job_title, base_salary)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (code, name, email, department, title, salary),
            )
            password = secrets.token_urlsafe(18)
            db.execute(
                """INSERT INTO users(username, password_hash, role, employee_id, clearance,
                   must_change_password) VALUES (?, ?, ?, ?, ?, 1)""",
                (username, hasher.hash(password), role, cursor.lastrowid, clearance),
            )
            credentials.append((username, password, role))

        admin_password = secrets.token_urlsafe(18)
        db.execute(
            """INSERT INTO users(username, password_hash, role, clearance, must_change_password)
               VALUES (?, ?, 'admin', 3, 1)""",
            ("admin", hasher.hash(admin_password)),
        )
        db.commit()

        rh_id = db.execute("SELECT id FROM users WHERE username='carla'").fetchone()["id"]
        db.execute(
            """INSERT INTO payrolls(employee_id, reference, overtime_hours, overtime_rate, bonus,
               other_earnings, deductions, gross_pay, net_pay, status, created_by)
               SELECT id, '2026-10', 4, 35, 300, 0, 450, 4940, 4490, 'rascunho', ?
               FROM employees WHERE code='E001'""", (rh_id,)
        )
        db.commit()
        credentials.append(("admin", admin_password, "admin"))
        print("Contas temporárias (troca de senha obrigatória no primeiro acesso):")
        for username, password, role in credentials:
            print(f"{role:12} usuário={username} senha={password}")
        print("Guarde as senhas exibidas; elas não serão mostradas novamente.")


if __name__ == "__main__":
    main()
