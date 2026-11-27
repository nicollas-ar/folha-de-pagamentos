"""Regras didáticas de RBAC, ABAC e ReBAC para a folha de pagamento."""


def can_access(user, action, resource=None):
    # Negação por padrão e atributo da conta.
    if not user or not user["active"]:
        return False

    role = user["role"]
    if role == "admin":
        return True

    resource = resource or {}
    # ABAC: ações de aprovação exigem nível 2; dados salariais, nível 3.
    required_clearance = 2 if action == "approve_payroll" else resource.get("sensitivity", 1)
    if user["clearance"] < required_clearance:
        return False

    # RBAC: equipe de RH administra lançamentos e consulta dados salariais.
    if role == "rh":
        return action in {
            "view_employees", "create_employee", "view_payroll",
            "create_payroll", "close_payroll"
        }

    # ReBAC: gestor só aprova registros de funcionários do próprio departamento.
    if role == "gestor" and action == "approve_payroll":
        return (
            resource.get("department") == user.get("department")
            and resource.get("status") == "rascunho"
        )
    if role == "gestor" and action == "view_employees":
        return resource.get("department") == user.get("department")

    # ReBAC: funcionário só consulta o próprio demonstrativo fechado.
    if role == "funcionario" and action == "view_payroll":
        return (
            resource.get("employee_id") == user.get("employee_id")
            and resource.get("status") == "fechada"
        )

    return False
