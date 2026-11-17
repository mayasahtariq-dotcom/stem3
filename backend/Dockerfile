FROM python:3.12-slim
WORKDIR /srv
COPY pyproject.toml .
COPY app ./app
COPY tests ./tests
RUN pip install --no-cache-dir -e ".[dev]"
CMD ["sleep", "infinity"]
