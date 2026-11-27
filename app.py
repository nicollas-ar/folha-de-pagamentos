import hmac
import os
import secrets
from functools import wraps
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
from flask import Flask, abort, flash, g, redirect, render_template, request, session, url_for

from access import can_access
from db import close_db, get_db, init_db
from payroll import calculate_pay, money

hasher = PasswordHasher()
PASSWORD_MIN = 15


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=os.environ.get("FLASK_SECRET_KEY", ""),
        DATABASE=os.environ.get(
            "PAYROLL_DATABASE", str(Path(app.instance_path) / "folha.db")
        ),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
    )
    if not app.config["SECRET_KEY"]:
        # Chave efêmera para facilitar a execução local; sessões expiram ao reiniciar.
        app.config["SECRET_KEY"] = secrets.token_hex(32)
        app.logger.warning("FLASK_SECRET_KEY não definida; sessões serão invalidadas ao reiniciar.")

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    app.teardown_appcontext(close_db)

    @app.before_request
    def load_security_context():
        g.user = None
        user_id = session.get("user_id")
        if user_id:
            row = get_db().execute(
                """SELECT u.*, e.full_name, e.department, e.code
                   FROM users u LEFT JOIN employees e ON e.id = u.employee_id
                   WHERE u.id = ?""", (user_id,)
            ).fetchone()
            if row and row["active"]:
                g.user = dict(row)
            else:
                session.clear()

        if "csrf_token" not in session:
            session["csrf_token"] = secrets.token_urlsafe(32)
        if request.method == "POST":
            submitted = request.form.get("csrf_token", "")
            if not hmac.compare_digest(submitted, session.get("csrf_token", "")):
                abort(400, description="Token CSRF ausente ou inválido.")

        allowed_without_password_change = {
            "login", "logout", "change_password", "static"
        }
        if (g.user and g.user["must_change_password"]
                and request.endpoint not in allowed_without_password_change):
            return redirect(url_for("change_password"))

    @app.context_processor
    def inject_template_values():
        return {"current_user": g.get("user"), "csrf_token": session.get("csrf_token", "")}

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not g.user:
                flash("Entre no sistema para continuar.", "warning")
                return redirect(url_for("login", next=request.path))
            return view(*args, **kwargs)
        return wrapped

    def require(action, resource=None):
        if not can_access(g.user, action, resource):
            abort(403)

    @app.get("/")
    def index():
        return redirect(url_for("dashboard" if g.user else "login"))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip().lower()
            password = request.form.get("password", "")
            row = get_db().execute(
                "SELECT * FROM users WHERE username = ? AND active = 1", (username,)
            ).fetchone()
            valid = False
            if row:
                try:
                    valid = hasher.verify(row["password_hash"], password)
                except (VerifyMismatchError, VerificationError, InvalidHashError):
                    valid = False
            if not valid:
                flash("Usuário ou senha inválidos.", "error")
            else:
                session.clear()
                session["user_id"] = row["id"]
                session["csrf_token"] = secrets.token_urlsafe(32)
                return redirect(url_for("change_password" if row["must_change_password"] else "dashboard"))
        return render_template("login.html")

    @app.post("/logout")
    def logout():
        session.clear()
        flash("Sessão encerrada.", "success")
        return redirect(url_for("login"))

    @app.route("/trocar-senha", methods=["GET", "POST"])
    @login_required
    def change_password():
        if request.method == "POST":
            password = request.form.get("password", "")
            confirmation = request.form.get("confirmation", "")
            if len(password) < PASSWORD_MIN or len(password) > 128:
                flash("Use uma senha com 15 a 128 caracteres.", "error")
            elif password != confirmation:
                flash("A confirmação da senha não corresponde.", "error")
            else:
                get_db().execute(
                    "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
                    (hasher.hash(password), g.user["id"]),
                )
                get_db().commit()
                flash("Senha atualizada.", "success")
                return redirect(url_for("dashboard"))
        return render_template("change_password.html")

    @app.get("/painel")
    @login_required
    def dashboard():
        db = get_db()
        if g.user["role"] == "funcionario":
            count = db.execute(
                "SELECT COUNT(*) AS n FROM payrolls WHERE employee_id = ? AND status = 'fechada'",
                (g.user["employee_id"],),
            ).fetchone()["n"]
        elif g.user["role"] == "gestor":
            count = db.execute(
                """SELECT COUNT(*) AS n FROM payrolls p JOIN employees e ON e.id=p.employee_id
                   WHERE e.department = ? AND p.status = 'rascunho'""", (g.user["department"],)
            ).fetchone()["n"]
        else:
            count = db.execute("SELECT COUNT(*) AS n FROM payrolls").fetchone()["n"]
        return render_template("dashboard.html", pending_count=count)

    @app.get("/funcionarios")
    @login_required
    def employees():
        rows = get_db().execute(
            "SELECT * FROM employees WHERE active = 1 ORDER BY full_name"
        ).fetchall()
        visible = []
        for row in rows:
            item = dict(row)
            resource = {"department": item["department"], "sensitivity": 1}
            if can_access(g.user, "view_employees", resource):
                visible.append(item)
        return render_template("employees.html", employees=visible)

    @app.route("/funcionarios/novo", methods=["GET", "POST"])
    @login_required
    def new_employee():
        require("create_employee")
        if request.method == "POST":
            data = {key: request.form.get(key, "").strip() for key in
                    ("code", "full_name", "email", "department", "job_title", "username")}
            password = request.form.get("password", "")
            role = request.form.get("role", "funcionario")
            try:
                salary = money(request.form.get("base_salary", ""))
                if not all(data.values()):
                    raise ValueError("Preencha todos os campos de texto.")
                if len(password) < PASSWORD_MIN or len(password) > 128:
                    raise ValueError("A senha inicial deve ter entre 15 e 128 caracteres.")
                if role not in {"funcionario", "gestor"}:
                    raise ValueError("O papel escolhido não é permitido neste formulário.")
                db = get_db()
                cursor = db.execute(
                    """INSERT INTO employees(code, full_name, email, department, job_title, base_salary)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (data["code"], data["full_name"], data["email"].lower(),
                     data["department"], data["job_title"], float(salary)),
                )
                employee_id = cursor.lastrowid
                # Nível 3 permite a consulta do próprio demonstrativo; ReBAC ainda
                # restringe funcionários ao registro vinculado à sua conta.
                clearance = 2 if role == "gestor" else 3
                db.execute(
                    """INSERT INTO users(username, password_hash, role, employee_id, clearance)
                       VALUES (?, ?, ?, ?, ?)""",
                    (data["username"].lower(), hasher.hash(password), role, employee_id, clearance),
                )
                db.commit()
                flash("Funcionário e conta criados. A troca da senha inicial será exigida no primeiro acesso.", "success")
                return redirect(url_for("employees"))
            except ValueError as error:
                flash(str(error), "error")
            except Exception as error:
                get_db().rollback()
                if "UNIQUE constraint failed" in str(error):
                    flash("Código, e-mail ou usuário já cadastrado.", "error")
                else:
                    raise
        return render_template("employee_form.html")

    @app.get("/folha")
    @login_required
    def payroll_list():
        rows = get_db().execute(
            """SELECT p.*, e.full_name, e.code, e.department
               FROM payrolls p JOIN employees e ON e.id=p.employee_id
               ORDER BY p.reference DESC, e.full_name"""
        ).fetchall()
        visible = []
        for row in rows:
            item = dict(row)
            resource = {
                "employee_id": item["employee_id"], "status": item["status"],
                "department": item["department"], "sensitivity": 3,
            }
            if can_access(g.user, "view_payroll", resource):
                item["may_close"] = can_access(g.user, "close_payroll", resource)
                item["may_approve"] = can_access(g.user, "approve_payroll", {
                    **resource, "sensitivity": 2
                })
                visible.append(item)
            elif g.user["role"] == "gestor" and can_access(
                    g.user, "approve_payroll", {**resource, "sensitivity": 2}):
                item["redacted"] = True
                item["may_approve"] = True
                item["may_close"] = False
                visible.append(item)
        return render_template("payroll.html", payrolls=visible)

    @app.route("/folha/nova", methods=["GET", "POST"])
    @login_required
    def new_payroll():
        require("create_payroll")
        db = get_db()
        employees_list = db.execute(
            "SELECT * FROM employees WHERE active=1 ORDER BY full_name"
        ).fetchall()
        if request.method == "POST":
            try:
                employee_id = int(request.form.get("employee_id", ""))
                employee = db.execute(
                    "SELECT * FROM employees WHERE id=? AND active=1", (employee_id,)
                ).fetchone()
                if not employee:
                    raise ValueError("Selecione um funcionário ativo.")
                reference = request.form.get("reference", "").strip()
                if not reference or len(reference) > 20:
                    raise ValueError("Informe a referência da folha (até 20 caracteres).")
                hours = float(request.form.get("overtime_hours", "0") or 0)
                rate = money(request.form.get("overtime_rate", "0") or 0)
                bonus = money(request.form.get("bonus", "0") or 0)
                other = money(request.form.get("other_earnings", "0") or 0)
                deductions = money(request.form.get("deductions", "0") or 0)
                totals = calculate_pay(employee["base_salary"], hours, rate, bonus, other, deductions)
                db.execute(
                    """INSERT INTO payrolls(employee_id, reference, overtime_hours, overtime_rate,
                       bonus, other_earnings, deductions, gross_pay, net_pay, created_by)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (employee_id, reference, hours, float(rate), float(bonus), float(other),
                     float(deductions), float(totals["gross_pay"]), float(totals["net_pay"]), g.user["id"]),
                )
                db.commit()
                flash("Lançamento criado como rascunho.", "success")
                return redirect(url_for("payroll_list"))
            except ValueError as error:
                flash(str(error), "error")
            except Exception as error:
                db.rollback()
                if "UNIQUE constraint failed" in str(error):
                    flash("Já existe uma folha desse funcionário para essa referência.", "error")
                else:
                    raise
        return render_template("payroll_form.html", employees=employees_list)

    @app.get("/folha/<int:payroll_id>")
    @login_required
    def payslip(payroll_id):
        row = get_db().execute(
            """SELECT p.*, e.full_name, e.code, e.email, e.department, e.job_title,
                      e.base_salary, u.clearance
               FROM payrolls p JOIN employees e ON e.id=p.employee_id
               JOIN users u ON u.employee_id=e.id
               WHERE p.id=?""", (payroll_id,)
        ).fetchone()
        if not row:
            abort(404)
        item = dict(row)
        resource = {
            "employee_id": item["employee_id"], "status": item["status"],
            "department": item["department"], "sensitivity": 3,
        }
        require("view_payroll", resource)
        return render_template("payslip.html", payroll=item)

    @app.post("/folha/<int:payroll_id>/aprovar")
    @login_required
    def approve_payroll(payroll_id):
        row = get_db().execute(
            """SELECT p.*, e.department FROM payrolls p JOIN employees e ON e.id=p.employee_id
               WHERE p.id=?""", (payroll_id,)
        ).fetchone()
        if not row:
            abort(404)
        resource = {**dict(row), "sensitivity": 2}
        require("approve_payroll", resource)
        get_db().execute(
            "UPDATE payrolls SET status='aprovada', approved_by=? WHERE id=? AND status='rascunho'",
            (g.user["id"], payroll_id),
        )
        get_db().commit()
        flash("Folha aprovada.", "success")
        return redirect(url_for("payroll_list"))

    @app.post("/folha/<int:payroll_id>/fechar")
    @login_required
    def close_payroll(payroll_id):
        row = get_db().execute("SELECT * FROM payrolls WHERE id=?", (payroll_id,)).fetchone()
        if not row:
            abort(404)
        resource = {**dict(row), "sensitivity": 3}
        require("close_payroll", resource)
        if row["status"] != "aprovada":
            abort(409, description="A folha precisa estar aprovada antes do fechamento.")
        get_db().execute("UPDATE payrolls SET status='fechada' WHERE id=?", (payroll_id,))
        get_db().commit()
        flash("Folha fechada; o demonstrativo ficou disponível ao funcionário.", "success")
        return redirect(url_for("payroll_list"))

    @app.errorhandler(400)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(409)
    def handle_error(error):
        return render_template("error.html", error=error), error.code

    with app.app_context():
        init_db()
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
