package com.example.demo.model;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class Main {

    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);

        System.out.println("===== RESTAURANT TABLE RESERVATION SYSTEM =====");

        // -------------------------------------------------
        // 1. CUSTOMER REGISTRATION
        // -------------------------------------------------

        System.out.println("\n----- CUSTOMER REGISTRATION -----");

        System.out.print("Enter Customer ID: ");
        String customerId = sc.nextLine();

        System.out.print("Enter Customer Name: ");
        String customerName = sc.nextLine();

        System.out.print("Enter Mobile Number: ");
        long mobileNumber = sc.nextLong();
        sc.nextLine();

        System.out.print("Create Password: ");
        long password = sc.nextLong();
        sc.nextLine();
        
        Customer customer = new Customer(
                customerId,
                customerName,
                mobileNumber,
                password
        );

        customer.register();

        System.out.println("\nRegistration Successful.");

        // -------------------------------------------------
        // 2. LOGIN
        // -------------------------------------------------

        System.out.println("\n----- CUSTOMER LOGIN -----");

        System.out.print("Enter Customer ID: ");
        String enteredId = sc.nextLine();

        System.out.print("Enter Password: ");
        long enteredPassword = sc.nextLong();
        sc.nextLine();

        if (
                !customer.getCustomerId().equals(enteredId)
                ||
                customer.getPassword() != enteredPassword
        ) {

            System.out.println("\nInvalid ID or Password.");

            sc.close();
            return;
        }

        System.out.println("\nLogin Successful.");
        // -------------------------------------------------
        // 3. RESTAURANT SELECTION
        // -------------------------------------------------

        Restaurant r1 = new Restaurant(
                "R101",
                "Spice Garden",
                "MG Road",
                "10 AM - 11 PM"
        );

        Restaurant r2 = new Restaurant(
                "R102",
                "Ocean Pearl",
                "Beach Road",
                "11 AM - 12 AM"
        );

        List<Restaurant> restaurants = new ArrayList<>();

        restaurants.add(r1);
        restaurants.add(r2);

        System.out.println("\n----- AVAILABLE RESTAURANTS -----");

        for (int i = 0; i < restaurants.size(); i++) {

            System.out.println(
                    (i + 1) + ". "
                            + restaurants.get(i).getRestaurantName()
            );
        }

        System.out.print("\nChoose Restaurant: ");
        int restaurantChoice = sc.nextInt();
        sc.nextLine();

        Restaurant selectedRestaurant =
                restaurants.get(restaurantChoice - 1);

        System.out.println("\nSelected Restaurant:");
        selectedRestaurant.showRestaurantDetails();

        // -------------------------------------------------
        // 4. TABLE SETUP
        // -------------------------------------------------

        System.out.println("\n----- TABLE SETUP -----");

        System.out.print("Enter Number Of Tables: ");
        int tableCount = sc.nextInt();
        sc.nextLine();

        for (int i = 0; i < tableCount; i++) {

            System.out.println("\nTable " + (i + 1));

            System.out.print("Enter Table ID: ");
            int tableId = sc.nextInt();
            sc.nextLine();

            System.out.println("Choose Table Type:");
            System.out.println("1. 2-Seater");
            System.out.println("2. 4-Seater");

            int typeChoice = sc.nextInt();
            sc.nextLine();

            int capacity;

            if (typeChoice == 1) {
                capacity = 2;
            } else {
                capacity = 4;
            }

            Table table = new Table(
                    tableId,
                    capacity,
                    true,
                    "Indoor"
            );

            selectedRestaurant.addTable(table);
        }

        // -------------------------------------------------
        // 5. TABLE BOOKING
        // -------------------------------------------------

        Table selectedTable = null;
        double paymentAmount = 0;

        while (true) {

            System.out.println("\n----- BOOK TABLE -----");

            System.out.print("Enter Required Table ID: ");
            int requiredTableId = sc.nextInt();
            sc.nextLine();

            // ---------------------------------------------
            // FIND TABLE BY ID
            // ---------------------------------------------

            for (int i = 0;
                 i < selectedRestaurant.getTables().size();
                 i++) {

                Table currentTable =
                        selectedRestaurant.getTables().get(i);

                if (
                        currentTable.getTableNumber()
                                == requiredTableId
                ) {

                    // -------------------------------------
                    // CHECK AVAILABILITY
                    // -------------------------------------

                    if (currentTable.isAvailable()) {

                        selectedTable = currentTable;

                        if (
                                currentTable.getCapacity() == 2
                        ) {

                            paymentAmount = 200;

                        } else {

                            paymentAmount = 400;
                        }

                        currentTable.setAvailability(false);

                        System.out.println(
                                "\nTable Available."
                        );

                        break;

                    } else {

                        System.out.println(
                                "\nTable Not Available."
                        );
                    }
                }
            }

            // ---------------------------------------------
            // TABLE FOUND
            // ---------------------------------------------

            if (selectedTable != null) {
                break;
            }

            // ---------------------------------------------
            // OPTIONS
            // ---------------------------------------------

            System.out.println("\n1. Enter Another Table ID");
            System.out.println("2. Join Waiting List");

            int option = sc.nextInt();
            sc.nextLine();

            if (option == 2) {

                selectedRestaurant.manageWaitingList(
                        customer.getName()
                );

                System.out.println(
                        "\nCustomer Added To Waiting List."
                );

                sc.close();
                return;
            }
        }

        // -------------------------------------------------
        // 6. CREATE RESERVATION
        // -------------------------------------------------

        Timeslot slot = new Timeslot(
                "T101",
                "6 PM",
                "7 PM",
                true
        );

        Reservation reservation = new Reservation(
                customer,
                selectedTable,
                slot,
                LocalDate.now()
        );

        customer.createReservation(reservation);

        System.out.println(
                "\nReservation Created Successfully."
        );

        // -------------------------------------------------
        // 7. PAYMENT OR CANCELLATION
        // -------------------------------------------------

        System.out.println("\n----- PAYMENT -----");

        System.out.println(
                "Total Amount: Rs." + paymentAmount
        );

        System.out.println("\n1. Pay");
        System.out.println("2. Cancel Reservation");

        int paymentChoice = sc.nextInt();
        sc.nextLine();

        // -------------------------------------------------
        // CANCEL RESERVATION
        // -------------------------------------------------

        if (paymentChoice == 2) {

            customer.cancelReservation(reservation);

            selectedRestaurant.cancelReservation(
                    selectedTable.getTableNumber()
            );

            System.out.println(
                    "\nReservation Cancelled."
            );

            sc.close();
            return;
        }

        // -------------------------------------------------
        // PROCESS PAYMENT
        // -------------------------------------------------

        Payment payment = new Payment(
                paymentAmount,
                reservation
        );

        payment.processPayment();

        System.out.println(
                payment.generateReceipt()
        );

        // -------------------------------------------------
        // 8. VIEW RESERVATIONS
        // -------------------------------------------------

        System.out.println(
                "\n----- CUSTOMER RESERVATIONS -----"
        );

        customer.viewReservations();

        // -------------------------------------------------
        // 9. SAVE TO FILE
        // -------------------------------------------------

        FileManager fileManager = new FileManager(
                "./data",
                "reservations",
                "txt"
        );

        List<Reservation> reservationList =
                new ArrayList<>();

        reservationList.add(reservation);

        fileManager.saveToFile(reservationList);

        System.out.println(
                "\nReservation Saved To File."
        );

        // -------------------------------------------------
        // 10. REVIEW
        // -------------------------------------------------

        System.out.println("\n----- REVIEW -----");

        customer.submitReview();

        System.out.println(
                "\n===== THANK YOU ====="
        );

        sc.close();
    }
}