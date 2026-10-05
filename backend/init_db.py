#!/usr/bin/env python3
"""
Initialize the database with tables
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Create a temporary connection to the default PostgreSQL database
from app.core.config import SessionLocal

def init_database():
    print("Creating PostgreSQL database tables...")
    try:
        # Import database models
        from app.core.config import Base, engine

        # Create tables in the summarizer database
        Base.metadata.create_all(bind=engine)
        print("PostgreSQL database tables created successfully!")
        print("You can now view tables in pgAdmin at localhost:5432")
        print("Login with: postgres / sql")

    except Exception as e:
        print(f"Error creating database tables: {e}")
        print("Check that PostgreSQL container is running:")
        print("   docker ps | findstr postgres")
        print("And that the connection details in config.py are correct")

if __name__ == "__main__":
    init_database()
