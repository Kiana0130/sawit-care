import os
from pathlib import Path
import subprocess
import sys


def test_existing_users_receive_session_version_zero(tmp_path):
    path = Path(__file__).parents[1] / "alembic/versions/0003_session_version.py"
    script = '''
import importlib.util, sys
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text
spec = importlib.util.spec_from_file_location("session_migration", sys.argv[1])
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
engine = create_engine("sqlite:///" + sys.argv[2])
with engine.begin() as connection:
    connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
    connection.execute(text("INSERT INTO users (id) VALUES (1)"))
    migration.op = Operations(MigrationContext.configure(connection))
    migration.upgrade()
    assert connection.execute(text("SELECT session_version FROM users WHERE id = 1")).scalar_one() == 0
'''
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)
    result = subprocess.run([sys.executable, "-c", script, str(path), str(tmp_path / "migration.db")], cwd=tmp_path, env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
