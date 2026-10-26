#!/usr/bin/env python3
"""
Initialize/upgrade the database schema by running Alembic migrations.
Equivalent to `alembic upgrade head` from the backend directory.
"""
import os

from alembic import command
from alembic.config import Config

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def init_database():
    command.upgrade(Config(os.path.join(BACKEND_DIR, "alembic.ini")), "head")


if __name__ == "__main__":
    init_database()
