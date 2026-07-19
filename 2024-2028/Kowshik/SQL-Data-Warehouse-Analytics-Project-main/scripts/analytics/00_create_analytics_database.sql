/*
=============================================================
Create Analytics Database and Physical Gold Tables
=============================================================
Script Purpose:
    This script creates a new database named 'DataWarehouseAnalytics'
    after checking if it already exists.

    The script creates physical Gold tables by importing data
    directly from the Gold views available in the DataWarehouse
    database.

    These physical tables are intended for reporting,
    dashboards, Power BI, Tableau, Excel, and analytical queries.

Prerequisites:
    1. DataWarehouse database must exist.
    2. Bronze layer must be loaded.
    3. Silver layer must be loaded.
    4. Gold views must already be created.

WARNING:
    Running this script will drop the entire
    'DataWarehouseAnalytics' database if it exists.

    All data inside the database will be permanently deleted.
=============================================================
*/

USE master;
GO

-- Drop and recreate the DataWarehouseAnalytics database
IF EXISTS (
    SELECT 1
    FROM sys.databases
    WHERE name = 'DataWarehouseAnalytics'
)
BEGIN
    ALTER DATABASE DataWarehouseAnalytics
    SET SINGLE_USER WITH ROLLBACK IMMEDIATE;

    DROP DATABASE DataWarehouseAnalytics;
END;
GO

-- Create Analytics Database
CREATE DATABASE DataWarehouseAnalytics;
GO

USE DataWarehouseAnalytics;
GO

-- Create Schema
CREATE SCHEMA gold;
GO

-- Create Customer Dimension
SELECT *
INTO gold.dim_customers
FROM DataWarehouse.gold.dim_customers;
GO

-- Create Product Dimension
SELECT *
INTO gold.dim_products
FROM DataWarehouse.gold.dim_products;
GO

-- Create Sales Fact Table
SELECT *
INTO gold.fact_sales
FROM DataWarehouse.gold.fact_sales;
GO

PRINT '================================================';
PRINT 'Gold Tables Created Successfully';
PRINT '================================================';
