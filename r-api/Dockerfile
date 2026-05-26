FROM rocker/r-ver:4.3.1
RUN apt-get update && apt-get install -y libpq-dev libssl-dev libcurl4-openssl-dev && rm -rf /var/lib/apt/lists/*
RUN R -e "install.packages(c('plumber','ggplot2','dplyr','tidyr','RPostgres','DBI','jsonlite','forecast'), repos='https://cloud.r-project.org')"
WORKDIR /app
COPY . .
EXPOSE 8000
CMD ["Rscript", "run.R"]
