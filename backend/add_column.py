from app.core.config import engine

# Add the column if it doesn't exist
try:
    with engine.connect() as conn:
        conn.execute("ALTER TABLE summaries ADD COLUMN approval_status VARCHAR DEFAULT 'pending'")
        conn.commit()
    print("Column added successfully")
except Exception as e:
    print(f"Error: {e}")
