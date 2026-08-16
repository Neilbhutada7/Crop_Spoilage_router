FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Environment variables
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_ENV=development

# Create a startup script that runs the setup tasks before starting Flask
RUN echo '#!/bin/bash\n\
python seed_db.py\n\
python seed_and_train.py\n\
flask run' > /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
