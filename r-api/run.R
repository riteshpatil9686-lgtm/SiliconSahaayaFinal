#!/usr/bin/env Rscript
# Start the SiliconSahaaya R Plumber API on port 8000
library(plumber)
pr("plumber.R") %>% pr_run(host = "0.0.0.0", port = 8000)
