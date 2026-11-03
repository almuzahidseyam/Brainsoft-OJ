FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends python3 g++ openjdk-21-jdk-headless \
    && rm -rf /var/lib/apt/lists/*
COPY entry.py /opt/judge/entry.py
RUN chmod 0555 /opt/judge/entry.py
WORKDIR /work
ENTRYPOINT ["python3", "-I", "-B", "/opt/judge/entry.py"]
