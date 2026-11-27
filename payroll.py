from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


CENT = Decimal("0.01")


def money(value):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Informe um valor numérico válido.")
    if not amount.is_finite() or amount < 0:
        raise ValueError("Os valores devem ser numéricos e não negativos.")
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_pay(base_salary, overtime_hours, overtime_rate,
                  bonus, other_earnings, deductions):
    base = money(base_salary)
    hours = Decimal(str(overtime_hours or 0))
    rate = money(overtime_rate)
    if not hours.is_finite() or hours < 0:
        raise ValueError("As horas extras devem ser não negativas.")
    overtime = (hours * rate).quantize(CENT, rounding=ROUND_HALF_UP)
    earnings = money(bonus) + money(other_earnings)
    gross = base + overtime + earnings
    discount = money(deductions)
    if discount > gross:
        raise ValueError("Os descontos não podem superar a remuneração bruta.")
    return {
        "overtime_pay": overtime,
        "gross_pay": gross.quantize(CENT),
        "net_pay": (gross - discount).quantize(CENT),
    }
