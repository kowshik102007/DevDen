package com.example.demo.service;

import com.example.demo.model.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class ReservationService {

    public String reserveTable(
            String customerId,
            String customerName,
            long phone,
            int capacity
    ) {

        Restaurant restaurant = new Restaurant(
                "R101",
                "Food Paradise",
                "Kochi",
                "10AM - 11PM"
        );

        Table table1 = new Table(1, 4, true, "Window");
        Table table2 = new Table(2, 6, true, "Center");

        restaurant.addTable(table1);
        restaurant.addTable(table2);

        Customer customer = new Customer(
                customerId,
                customerName,
                phone,capacity
 );

        customer.register();

        Timeslot slot = new Timeslot(
                "TS101",
                "7PM",
                "9PM",
                true
        );

        Table table =
                restaurant.findAvailableTable(capacity);

        if(table == null){

            restaurant.manageWaitingList(customerName);

            return "Added to waiting list";
        }

        Reservation reservation =
                new Reservation(
                        customer,
                        table,
                        slot,
                        LocalDate.now()
                );

        customer.createReservation(reservation);

        Payment payment =
                new Payment(500, reservation);

        payment.processPayment();

        return "Reservation Successful";
    }
}