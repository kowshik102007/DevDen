package com.example.demo.model;

import java.time.LocalDate;
import java.util.UUID;

public class Payment {
    private String paymentId;
    private double amount;
    private String paymentDate;
    private String status;
    private Reservation reservation;

    public Payment(double amount, Reservation reservation) {
        this.paymentId = UUID.randomUUID().toString();
        this.amount = amount;
        this.paymentDate = LocalDate.now().toString();
        this.status = "PENDING";
        this.reservation = reservation;
    }

    public boolean processPayment() {
        if (!validatePayment()) {
            status = "FAILED";
            return false;
        }
        status = "SUCCESS";
        if (reservation != null) {
            reservation.confirmReservation();
        }
        System.out.println("Payment successful: " + paymentId);
        return true;
    }
    public boolean refundPayment() {
        if (!status.equals("SUCCESS")) {
            System.out.println("Refund failed: Payment not successful.");
            return false;
        }
        status = "REFUNDED";
        System.out.println("Payment refunded: " + paymentId);
        return true;
    }
    public boolean validatePayment() {
        return amount > 0;
    }

    public String getPaymentStatus() {
        return status;
    }

    public String generateReceipt() {
        return "Receipt:\n"
                + "Payment ID: " + paymentId + "\n"
                + "Amount: " + amount + "\n"
                + "Date: " + paymentDate + "\n"
                + "Status: " + status;
    }

    public Reservation getReservation() {
        return reservation;
    }
}
