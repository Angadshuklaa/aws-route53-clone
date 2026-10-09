from app.api import auth, dashboard, health, hosted_zones, records

routers = [health.router, auth.router, dashboard.router, hosted_zones.router, records.router]

__all__ = ["routers"]
