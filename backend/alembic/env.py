from sqlalchemy import create_engine

from alembic import context
from app.config import get_settings

url = get_settings().database_url
if not url:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_engine(url)
with engine.connect() as conn:
    context.configure(connection=conn, target_metadata=None)
    with context.begin_transaction():
        context.run_migrations()
