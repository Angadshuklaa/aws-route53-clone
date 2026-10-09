from app.api import auth, health, hosted_zones, records

routers = [health.router, auth.router, hosted_zones.router, records.router]

__all__ = ["routers"]
