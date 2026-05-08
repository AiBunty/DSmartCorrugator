FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg + bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir uv && uv pip install --system -r pyproject.toml 2>/dev/null || \
    pip install --no-cache-dir \
        fastapi==0.111.0 \
        uvicorn[standard]==0.29.0 \
        sqlalchemy[asyncio]==2.0.30 \
        asyncpg==0.29.0 \
        alembic==1.13.1 \
        redis[hiredis]==5.0.4 \
        passlib[bcrypt]==1.7.4 \
        bcrypt==4.0.1 \
        python-multipart==0.0.9 \
        pydantic[email]==2.7.1 \
        pydantic-settings==2.3.1 \
        cryptography==42.0.8 \
        aiofiles==23.2.1 \
        openpyxl==3.1.2 \
        httpx==0.27.0 \
        python-dotenv==1.0.1 \
        boto3==1.34.95

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
