package com.example.demo.model;

import java.util.ArrayList;

class Customer {
    private String customerId;
    private String name;
    private long phoneNumber;
    private long password;
    private ArrayList<Reservation> reservations = new ArrayList<>();

    public Customer(String customerId, String name, long phoneNumber, long password) {
        this.customerId = customerId;
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.password=password;
    }

    public void register() {
        FileManager fileManager = new FileManager("./data", "customers", "txt");
        fileManager.saveToFile("Customer: " + name + ", Phone: " + phoneNumber);
        System.out.println("Customer registered");
    }

    public void login() {
        FileManager fileManager = new FileManager("./data", "customers", "txt");
        System.out.println(fileManager.readFromFile());
        System.out.println("Customer logged in");
    }

    public void viewReservations() {
        if (reservations.isEmpty()) {
            System.out.println("No reservations found.");
            return;
        }
        for (Reservation reservation : reservations) {
            reservation.viewDetails();
        }
    }

    public void cancelReservation(Reservation reservation) {
        reservation.cancelReservation();
    }

    public void submitReview() {
        System.out.println("Review submitted");
    }

    public void createReservation(Reservation reservation) {
        reservations.add(reservation);
        System.out.println("Reservation added for " + name);
    }

    public String getName() {
        return name;
    }

    public String getCustomerId() {
        return customerId;
    }

    public long getPassword() {
        return password;
    }	}
