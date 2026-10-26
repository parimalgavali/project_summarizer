FROM python:3.12-slim
# Set the working directory in the container
WORKDIR /code
# Install system-level packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \ 
    && rm -rf /var/lib/apt/lists/*
# Copy the requirements file first to leverage Docker cache
COPY ./requirements.txt /code/requirements.txt
# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r /code/requirements.txt
RUN pip install uvicorn
# Expose the port
COPY . /code/
EXPOSE 8000
# Run the application
# Apply database migrations, then start the API
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]