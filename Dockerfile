FROM python:3.12
#!!!WORKDIR /usr/local/app
WORKDIR /app

# Install the application dependencies
COPY requirements.txt ./
RUN apt-get update && apt-get install -y \
    docker.io \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

# Copy in the source code
COPY . ./src
#EXPOSE 5000

# Setup an app user so the container doesn't run as the root user
# ARG UID=501
# ARG GID=20
ARG UID=501
ARG GID=1001
RUN echo "Using UID=$UID and GID=$GID" && getent group $GID || echo "GID $GID is available"
RUN addgroup --gid $GID appgroup && adduser --uid $UID --gid $GID --disabled-password appuser

#RUN addgroup --gid $GID appgroup && adduser --uid $UID --gid $GID --disabled-password appuser
#RUN adduser --uid $UID --gid $GID --disabled-password appuser
USER appuser

# RUN useradd app
#!!!USER app

# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
CMD ["flask", "--app", "src/app.py", "--debug", "run","--host=0.0.0.0", "--port=5010"]