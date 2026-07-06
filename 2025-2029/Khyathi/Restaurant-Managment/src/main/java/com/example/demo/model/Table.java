package com.example.demo.model;

public class Table {

    private int tableNumber;
    private int capacity;
    private boolean availability;
    private String location;

    public Table(int tableNumber, int capacity,
                 boolean availability, String location) {

        this.tableNumber = tableNumber;
        this.capacity = capacity;
        this.availability = availability;
        this.location = location;
    }
    public int getTableNumber() {
        return tableNumber;
    }
    public boolean isAvailable() {
        return availability;
    }
    public void setAvailability(boolean availability) {
        this.availability = availability;
    }
    public int getCapacity() {
        return capacity;
    }
    public void getTableDetails() {
        System.out.println("Table Number : " + tableNumber);
        System.out.println("Capacity     : " + capacity);
        System.out.println("Available    : " + availability);
        System.out.println("Location     : " + location);
    }
}