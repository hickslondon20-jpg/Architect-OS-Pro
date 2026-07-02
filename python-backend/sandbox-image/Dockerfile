FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    pandas \
    numpy \
    python-docx \
    python-pptx \
    openpyxl \
    matplotlib \
    ipython \
    ipykernel

WORKDIR /sandbox

RUN python -m venv --system-site-packages /sandbox/.sandbox-venv \
    && /sandbox/.sandbox-venv/bin/pip install --no-cache-dir --upgrade pip \
    && mkdir -p /sandbox/.sandbox-pip-cache
