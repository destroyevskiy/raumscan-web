FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=2
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client libgomp1 libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/raumscan
COPY requirements.txt .
RUN pip install --no-cache-dir cryptography -r requirements.txt
RUN useradd --create-home studio
COPY bootstrap.py .
USER studio
CMD ["python", "bootstrap.py"]
