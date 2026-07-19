# 🚀 SQL Data Warehouse & Analytics Project

An end-to-end **Data Engineering** and **SQL Analytics** project built using **SQL Server**. This project demonstrates how to design a modern data warehouse using the **Medallion Architecture (Bronze, Silver, Gold)**, implement ETL pipelines, model data with a **Star Schema**, and perform business-focused analytics.

---

## 📖 Project Overview

This project simulates a real-world data warehouse by integrating data from multiple source systems (ERP and CRM) into a centralized analytical database.

The project covers the complete data engineering workflow, including:

- Data ingestion from CSV files
- ETL pipeline development using Stored Procedures
- Data cleansing and transformation
- Data quality validation
- Star Schema data modeling
- Business-ready Gold layer
- SQL-based analytics and reporting

---

## 🏗️ Data Architecture

The project follows the **Medallion Architecture** consisting of three layers:

### 🥉 Bronze Layer
- Loads raw ERP and CRM data from CSV files.
- Stores source data without modifications.

### 🥈 Silver Layer
- Cleans and standardizes the data.
- Removes duplicates and resolves data quality issues.
- Integrates data from multiple sources.

### 🥇 Gold Layer
- Builds a Star Schema for analytics.
- Creates business-ready views for reporting and decision-making.

---

## ⚙️ ETL Workflow

```
CSV Files
    │
    ▼
Bronze Layer
(Raw Data)
    │
    ▼
Silver Layer
(Data Cleaning & Transformation)
    │
    ▼
Gold Layer
(Star Schema)
    │
    ▼
Analytics & Reports
```

---

## 🛠️ Technologies Used

- Microsoft SQL Server
- SQL Server Management Studio (SSMS)
- T-SQL
- Stored Procedures
- Medallion Architecture
- Star Schema Modeling
- Git & GitHub

---

## 📊 Analytics Performed

The project includes SQL scripts for:

- Database Exploration
- Dimension Analysis
- Sales Trend Analysis
- Customer Analysis
- Product Performance
- Ranking Analysis
- Cumulative Analysis
- Customer Segmentation
- Performance Analysis
- Business Reports

---

## 📂 Project Structure

```text
sql-data-warehouse-project/
│
├── datasets/
│   ├── source_crm/
│   └── source_erp/
│
├── docs/
│   ├── Data Analytics Roadmap.png
│   ├── data_catalog.md
│   └── naming_conventions.md
│
├── scripts/
│   ├── analytics/
│   ├── bronze/
│   ├── silver/
│   ├── gold/
│   └── init_database.sql
│
├── tests/
│   ├── quality_checks_gold.sql
│   └── quality_checks_silver.sql
│
├── LICENSE
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Microsoft SQL Server
- SQL Server Management Studio (SSMS)

### Setup

1. Clone the repository.

```bash
git clone https://github.com/your-username/sql-data-warehouse-project.git
```

2. Open the project in SSMS.

3. Execute the scripts in the following order:

```
scripts/init_database.sql

scripts/bronze/ddl_bronze.sql
scripts/bronze/proc_load_bronze.sql

scripts/silver/ddl_silver.sql
scripts/silver/proc_load_silver.sql

scripts/gold/ddl_gold.sql

scripts/analytics/
```

4. Run the quality check scripts from the `tests` folder.

---

## ✅ Project Highlights

- End-to-End Data Warehouse Development
- ETL Pipeline using Stored Procedures
- Data Cleansing and Validation
- Star Schema Design
- Business-Oriented SQL Analytics
- Well-Structured and Modular SQL Scripts

---

## 📌 Future Improvements

- Incremental Data Loading
- Slowly Changing Dimensions (SCD)
- Power BI Dashboard Integration
- SQL Server Agent Scheduling
- Performance Optimization

---

## 📄 License

This project is licensed under the MIT License.
