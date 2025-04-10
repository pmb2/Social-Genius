# Use an official Python image as the base
FROM python:3.11-slim

# Set environment variables to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=5055
ENV HOST=0.0.0.0

# Install system dependencies 
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    xauth \
    xvfb \
    && rm -rf /var/lib/apt/lists/*  # Clean up APT cache to reduce image size

# Install Playwright
RUN pip install playwright && \
    playwright install-deps && \
    playwright install

# Create screenshots directory
RUN mkdir -p /app/screenshots && chmod 777 /app/screenshots

# Copy requirements.txt and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the application files
COPY server.py /app/server.py

# Set working directory
WORKDIR /app

# Expose the port
EXPOSE 5055

# Start command
CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5055"]