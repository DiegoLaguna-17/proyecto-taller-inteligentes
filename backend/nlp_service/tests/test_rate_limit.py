from app.rate_limit import VENTANA_SEGUNDOS, LimitadorDeTasa


class Reloj:
    def __init__(self):
        self.ahora = 1000.0

    def __call__(self):
        return self.ahora


def test_ventana_deslizante_libera_cupo_al_vencer():
    reloj = Reloj()
    limitador = LimitadorDeTasa(reloj=reloj)

    assert limitador.registrar("10.0.0.1", 2) == 0
    reloj.ahora += 10
    assert limitador.registrar("10.0.0.1", 2) == 0
    espera = limitador.registrar("10.0.0.1", 2)
    assert espera == VENTANA_SEGUNDOS - 10

    reloj.ahora += espera
    assert limitador.registrar("10.0.0.1", 2) == 0


def test_cada_ip_tiene_su_propio_cupo():
    limitador = LimitadorDeTasa(reloj=Reloj())

    assert limitador.registrar("10.0.0.1", 1) == 0
    assert limitador.registrar("10.0.0.1", 1) > 0
    assert limitador.registrar("10.0.0.2", 1) == 0


def test_reiniciar_borra_el_historial():
    limitador = LimitadorDeTasa(reloj=Reloj())
    limitador.registrar("10.0.0.1", 1)

    limitador.reiniciar()

    assert limitador.registrar("10.0.0.1", 1) == 0
