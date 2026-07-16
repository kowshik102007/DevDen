# Alerts package — persona-based, locality-aware alert system
from .personas import Persona, PersonaContext, LocalityStats, build_context
from .generators import AlertType, generate_alert

__all__ = [
    "Persona", "PersonaContext", "LocalityStats", "build_context",
    "AlertType", "generate_alert",
]
