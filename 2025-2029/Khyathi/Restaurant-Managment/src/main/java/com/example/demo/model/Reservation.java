package com.example.demo.model;

import java.time.LocalDate;
import java.util.UUID;
public class Reservation {
    private String reservationId;
    private Customer customer;
    private Table table;
    private TimeSlot timeslot;
    private LocalDate reservationDate;
    private String status;
    public Reservation(Customer customer, Table table, TimeSlot timeslot, LocalDate reservationDate) {
        this.reservationId = UUID.randomUUID().toString();
        this.customer = customer;
        this.table = table;
        this.timeslot = timeslot;
        this.reservationDate = reservationDate;
        this.status = "PENDING";
    }
    public void confirmReservation() {
        status = "CONFIRMED";
        table.setAvailability(false);
        timeslot.setAvailable(false);
        System.out.println("Reservation confirmed.");
    }
    public void cancelReservation() {
        status = "CANCELLED";
        table.setAvailability(true);
        timeslot.setAvailable(true);
        System.out.println("Reservation cancelled.");
    }
    public void viewDetails() {
        System.out.println("Reservation ID : " + reservationId);
        System.out.println("Customer       : " + customer.getName());
        System.out.println("Table Number   : " + table.getTableNumber());
        System.out.println("Timeslot       : " + timeslot);
        System.out.println("Date           : " + reservationDate);
        System.out.println("Status         : " + status);
    }

    @Override
    public String toString() {
        return reservationId + "," + customer.getCustomerId() + "," + table.getTableNumber()
                + "," + timeslot + "," + reservationDate + "," + status;
    }
}
