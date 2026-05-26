# SiliconSahaaya R Analytics API — Port 8000
# Serves ggplot2 visualizations and statistical analysis via Plumber

library(plumber)
library(ggplot2)
library(dplyr)
library(tidyr)
library(RPostgres)
library(DBI)
library(jsonlite)

# Colors matching the UI theme
FOREST_GREEN <- "#1a4731"
SAFFRON <- "#ff6b00"
LIGHT_GREEN <- "#2d7a52"
BG_DARK <- "#0d2418"
TEXT_COLOR <- "#ffffff"

# DB connection helper
get_db_conn <- function() {
  tryCatch({
    dbConnect(
      RPostgres::Postgres(),
      dbname   = Sys.getenv("DB_NAME", "silicon_sahaaya"),
      host     = Sys.getenv("DB_HOST", "localhost"),
      port     = as.integer(Sys.getenv("DB_PORT", 5432)),
      user     = Sys.getenv("DB_USER", "postgres"),
      password = Sys.getenv("DB_PASSWORD", "password")
    )
  }, error = function(e) NULL)
}

# Dark theme for all ggplot2 charts
dark_theme <- function() {
  theme_minimal() +
  theme(
    plot.background  = element_rect(fill = BG_DARK, color = NA),
    panel.background = element_rect(fill = "#0d2418", color = NA),
    panel.grid.major = element_line(color = "#1a4731", linewidth = 0.3),
    panel.grid.minor = element_blank(),
    text             = element_text(color = TEXT_COLOR, family = "sans"),
    axis.text        = element_text(color = "#ffffff80", size = 9),
    axis.title       = element_text(color = "#ffffff90", size = 10),
    plot.title       = element_text(color = TEXT_COLOR, size = 14, face = "bold"),
    plot.subtitle    = element_text(color = "#ffffff60", size = 10),
    legend.background = element_rect(fill = BG_DARK, color = NA),
    legend.text      = element_text(color = "#ffffff80")
  )
}

# Generate mock data if DB not available
mock_weekly_data <- function() {
  dates <- seq(Sys.Date() - 6, Sys.Date(), by = "day")
  data.frame(
    date       = dates,
    submitted  = sample(15:60, 7, replace = TRUE),
    resolved   = sample(10:40, 7, replace = TRUE)
  )
}

mock_category_data <- function() {
  data.frame(
    category = c("Roads","Garbage","Water","Streetlight","Sewage","Parks","Noise"),
    count    = c(120, 95, 78, 65, 55, 32, 18)
  )
}

mock_dept_data <- function() {
  data.frame(
    department = c("Roads & Infra","Solid Waste Mgmt","Water & Sewage","BESCOM","Parks & Gardens"),
    resolution_rate = c(72, 85, 68, 91, 60),
    avg_days = c(6.2, 2.8, 4.5, 1.9, 9.1)
  )
}

#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

#* @get /health
function() list(status = "ok", service = "SiliconSahaaya R Analytics")

#* Weekly trend bar chart
#* @get /plot/weekly-trend
#* @serializer png list(width=700, height=350)
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "
        SELECT DATE(created_at) as date,
          COUNT(*) as submitted,
          COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved
        FROM complaints WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at) ORDER BY date")
      dbDisconnect(conn)
      if (nrow(df) == 0) df <- mock_weekly_data()
    }, error = function(e) { df <<- mock_weekly_data(); dbDisconnect(conn) })
  } else df <- mock_weekly_data()

  df_long <- pivot_longer(df, cols = c("submitted","resolved"), names_to = "type", values_to = "count")
  df_long$type <- factor(df_long$type, levels = c("submitted","resolved"))

  p <- ggplot(df_long, aes(x = as.Date(date), y = count, fill = type)) +
    geom_col(position = "dodge", width = 0.6, alpha = 0.9) +
    scale_fill_manual(values = c("submitted" = SAFFRON, "resolved" = LIGHT_GREEN),
                      labels = c("Submitted", "Resolved")) +
    scale_x_date(date_labels = "%a %d") +
    labs(title = "Weekly Complaint Trend", subtitle = "Last 7 days — Submitted vs Resolved",
         x = NULL, y = "Complaints", fill = NULL) +
    dark_theme()
  print(p)
}

#* Category donut chart
#* @get /plot/category-pie
#* @serializer png list(width=600, height=400)
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "SELECT category, COUNT(*) as count FROM complaints GROUP BY category ORDER BY count DESC")
      dbDisconnect(conn)
      if (nrow(df) == 0) df <- mock_category_data()
    }, error = function(e) { df <<- mock_category_data(); try(dbDisconnect(conn), silent=TRUE) })
  } else df <- mock_category_data()

  COLORS <- c("#ff6b00","#1a4731","#2d7a52","#fbbf24","#3b82f6","#8b5cf6","#ec4899")
  p <- ggplot(df, aes(x = 2, y = count, fill = category)) +
    geom_bar(stat = "identity", width = 1, color = BG_DARK, linewidth = 0.5) +
    coord_polar("y", start = 0) +
    xlim(0.5, 2.5) +
    scale_fill_manual(values = COLORS[1:nrow(df)]) +
    labs(title = "Complaint Category Distribution", fill = "Category") +
    dark_theme() +
    theme(axis.text = element_blank(), axis.title = element_blank(),
          panel.grid = element_blank(), plot.margin = margin(10,10,10,10))
  print(p)
}

#* Department performance horizontal bar
#* @get /plot/department-performance
#* @serializer png list(width=700, height=380)
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "
        SELECT d.name as department,
          ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as resolution_rate,
          ROUND(AVG(c.actual_resolution_days), 1) as avg_days
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.name ORDER BY resolution_rate DESC")
      dbDisconnect(conn)
      if (nrow(df) == 0) df <- mock_dept_data()
    }, error = function(e) { df <<- mock_dept_data(); try(dbDisconnect(conn), silent=TRUE) })
  } else df <- mock_dept_data()

  df$department <- factor(df$department, levels = rev(df$department))
  p <- ggplot(df, aes(x = resolution_rate, y = department, fill = resolution_rate)) +
    geom_col(alpha = 0.85, width = 0.6) +
    geom_text(aes(label = paste0(resolution_rate, "%")), hjust = -0.2, color = TEXT_COLOR, size = 3.5) +
    scale_fill_gradient(low = LIGHT_GREEN, high = SAFFRON, guide = "none") +
    xlim(0, 115) +
    labs(title = "Department Resolution Performance", subtitle = "% of complaints resolved",
         x = "Resolution Rate (%)", y = NULL) +
    dark_theme()
  print(p)
}

#* Resolution time histogram
#* @get /plot/resolution-histogram
#* @serializer png list(width=700, height=350)
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "SELECT actual_resolution_days FROM complaints WHERE actual_resolution_days IS NOT NULL AND actual_resolution_days > 0 LIMIT 500")
      dbDisconnect(conn)
    }, error = function(e) {
      df <<- data.frame(actual_resolution_days = pmax(1, rnorm(200, 6, 3)))
      try(dbDisconnect(conn), silent=TRUE)
    })
  } else df <- data.frame(actual_resolution_days = pmax(1, rnorm(200, 6, 3)))

  if (nrow(df) == 0) df <- data.frame(actual_resolution_days = pmax(1, rnorm(200, 6, 3)))

  p <- ggplot(df, aes(x = actual_resolution_days)) +
    geom_histogram(bins = 20, fill = SAFFRON, color = BG_DARK, alpha = 0.85) +
    geom_vline(xintercept = mean(df$actual_resolution_days, na.rm=TRUE), color = LIGHT_GREEN, linetype = "dashed", linewidth = 1) +
    labs(title = "Resolution Time Distribution", subtitle = "Days taken to resolve complaints (green = mean)",
         x = "Days to Resolution", y = "Number of Complaints") +
    dark_theme()
  print(p)
}

#* Satisfaction score gauge
#* @get /plot/satisfaction-score
#* @serializer png list(width=500, height=300)
function() {
  conn <- get_db_conn()
  avg_rating <- 4.2
  if (!is.null(conn)) {
    tryCatch({
      res <- dbGetQuery(conn, "SELECT ROUND(AVG(citizen_rating), 2) as avg_rating FROM complaints WHERE citizen_rating IS NOT NULL")
      dbDisconnect(conn)
      if (!is.na(res$avg_rating[1])) avg_rating <- as.numeric(res$avg_rating[1])
    }, error = function(e) try(dbDisconnect(conn), silent=TRUE))
  }

  gauge_df <- data.frame(
    x = c(1), y = c(1),
    label = paste0(avg_rating, "/5"),
    sublabel = "Avg Citizen Satisfaction"
  )

  p <- ggplot() +
    annotate("rect", xmin=0, xmax=5, ymin=0, ymax=1, fill=FOREST_GREEN, alpha=0.3) +
    annotate("rect", xmin=0, xmax=avg_rating, ymin=0, ymax=1, fill=SAFFRON, alpha=0.7) +
    annotate("text", x=2.5, y=0.5, label=paste0("★ ", avg_rating, " / 5"), size=8, color=TEXT_COLOR, fontface="bold") +
    annotate("text", x=2.5, y=-0.3, label="Average Citizen Satisfaction Score", size=4, color="#ffffff80") +
    xlim(-0.5, 5.5) + ylim(-0.6, 1.3) +
    labs(title = "Citizen Satisfaction Score") +
    dark_theme() +
    theme(axis.text=element_blank(), axis.title=element_blank(), panel.grid=element_blank())
  print(p)
}

#* Department efficiency analysis (JSON)
#* @get /analysis/department-efficiency
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "
        SELECT d.name as department, d.sla_days,
          COUNT(c.id) as total,
          ROUND(AVG(c.actual_resolution_days), 2) as mean_days,
          ROUND(STDDEV(c.actual_resolution_days), 2) as sd_days,
          ROUND(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed'))::decimal / NULLIF(COUNT(c.id),0) * 100, 1) as resolution_pct,
          ROUND(COUNT(c.id) FILTER (WHERE c.actual_resolution_days <= d.sla_days)::decimal / NULLIF(COUNT(c.id) FILTER (WHERE c.status IN ('resolved','closed')),0) * 100, 1) as sla_compliance_pct
        FROM departments d LEFT JOIN complaints c ON c.department_id = d.id
        GROUP BY d.id, d.name, d.sla_days")
      dbDisconnect(conn)
      return(toJSON(df, na="null"))
    }, error = function(e) try(dbDisconnect(conn), silent=TRUE))
  }
  toJSON(mock_dept_data(), na="null")
}

#* Complaint trends analysis (JSON)
#* @get /analysis/complaint-trends
function(period = "30") {
  conn <- get_db_conn()
  p <- as.integer(period)
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, sprintf("
        SELECT DATE(created_at) as date, category, COUNT(*) as count
        FROM complaints WHERE created_at >= NOW() - INTERVAL '%d days'
        GROUP BY DATE(created_at), category ORDER BY date", p))
      dbDisconnect(conn)
      return(toJSON(df, na="null"))
    }, error = function(e) try(dbDisconnect(conn), silent=TRUE))
  }
  toJSON(list(note="DB unavailable, connect PostgreSQL"), na="null")
}

#* Ward hotspot analysis (JSON)
#* @get /analysis/ward-hotspots
function() {
  conn <- get_db_conn()
  if (!is.null(conn)) {
    tryCatch({
      df <- dbGetQuery(conn, "
        SELECT w.name as ward, wh.category, wh.complaint_count, wh.hotspot_level, w.lat, w.lng
        FROM ward_hotspots wh JOIN wards w ON w.id = wh.ward_id ORDER BY wh.complaint_count DESC")
      dbDisconnect(conn)
      return(toJSON(df, na="null"))
    }, error = function(e) try(dbDisconnect(conn), silent=TRUE))
  }
  toJSON(list(note="DB unavailable"), na="null")
}
