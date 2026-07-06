package com.example.demo.model;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ReservationController {

    // In-memory state (replaces Scanner flow)
    private static Customer currentCustomer = null;
    private static Restaurant selectedRestaurant = null;
    private static Reservation currentReservation = null;
    private static double paymentAmount = 0;

    private static final List<Restaurant> restaurants = new ArrayList<>();

    static {
        Restaurant r1 = new Restaurant("R101", "Spice Garden", "MG Road", "10 AM - 11 PM");
        Restaurant r2 = new Restaurant("R102", "Ocean Pearl", "Beach Road", "11 AM - 12 AM");
        restaurants.add(r1);
        restaurants.add(r2);
    }

    // ── 1. REGISTER ──────────────────────────
    @PostMapping("/register")
    public Map<String, String> register(@RequestBody Map<String, String> body) {
        String id       = body.get("customerId");
        String name     = body.get("customerName");
        long   phone    = Long.parseLong(body.get("mobileNumber"));
        long   password = Long.parseLong(body.get("password"));

        currentCustomer = new Customer(id, name, phone, password);
        currentCustomer.register();

        return Map.of("message", "Registration successful for " + name);
    }

    // ── 2. LOGIN──────────────────────────────────────────
    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> body) {
        String id       = body.get("customerId");
        long   password = Long.parseLong(body.get("password"));

        if (currentCustomer == null
                || !currentCustomer.getCustomerId().equals(id)
                || currentCustomer.getPassword() != password) {
            return Map.of("message", "FAIL");
        }
        return Map.of("message", "Login successful");
    }

    // ── 3. GET RESTAURANTS ────────────────────────────────────
    @GetMapping("/restaurants")
    public List<Map<String, String>> getRestaurants() {
        List<Map<String, String>> list = new ArrayList<>();
        for (int i = 0; i < restaurants.size(); i++) {
            Restaurant r = restaurants.get(i);
            list.add(Map.of("index", String.valueOf(i + 1),
                            "name",  r.getRestaurantName()));
        }
        return list;
    }

    // ── 4. SELECT RESTAURANT ──────────────────────────────────
    @PostMapping("/selectRestaurant")
    public Map<String, String> selectRestaurant(@RequestBody Map<String, String> body) {
        int choice = Integer.parseInt(body.get("choice"));
        selectedRestaurant = restaurants.get(choice - 1);
        return Map.of("message", "Selected: " + selectedRestaurant.getRestaurantName());
    }

    // ── 5. ADD TABLE ──────────────────────────────────────────
    @PostMapping("/addTable")
    public Map<String, String> addTable(@RequestBody Map<String, String> body) {
        int tableId   = Integer.parseInt(body.get("tableId"));
        int typeChoice = Integer.parseInt(body.get("typeChoice")); // 1=2-seater, 2=4-seater
        int capacity  = (typeChoice == 1) ? 2 : 4;

        Table table = new Table(tableId, capacity, true, "Indoor");
        selectedRestaurant.addTable(table);
        return Map.of("message", "Table " + tableId + " added (" + capacity + "-seater)");
    }

    // ── 6. GET TABLES ─────────────────────────────────────────
    @GetMapping("/tables")
    public List<Map<String, String>> getTables() {
        List<Map<String, String>> list = new ArrayList<>();
        if (selectedRestaurant == null) return list;
        for (Table t : selectedRestaurant.getTables()) {
            list.add(Map.of(
                "tableId",    String.valueOf(t.getTableNumber()),
                "capacity",   String.valueOf(t.getCapacity()),
                "available",  String.valueOf(t.isAvailable())
            ));
        }
        return list;
    }

    // ── 7. BOOK TABLE ──────────────────────────────────
    @PostMapping("/bookTable")
    public Map<String, String> bookTable(@RequestBody Map<String, String> body) {
        int tableId = Integer.parseInt(body.get("tableId"));

        for (Table t : selectedRestaurant.getTables()) {
            if (t.getTableNumber() == tableId) {
                if (!t.isAvailable()) {
                    return Map.of("message", "NOT_AVAILABLE");
                }
                t.setAvailability(false);
                paymentAmount = (t.getCapacity() == 2) ? 200 : 400;

                Timeslot slot = new Timeslot("T101", "6 PM", "7 PM", true);
                currentReservation = new Reservation(
                        currentCustomer, t, slot, LocalDate.now());
                currentCustomer.createReservation(currentReservation);

                return Map.of("message", "Reservation created. Amount: Rs." + paymentAmount,
                              "amount",  String.valueOf(paymentAmount));
            }
        }
        return Map.of("message", "TABLE_NOT_FOUND");
    }

    // ── 8. JOIN WAITING LIST ──────────────────────────────────
    @PostMapping("/waitingList")
    public Map<String, String> joinWaiting() {
        if (currentCustomer == null) return Map.of("message", "Not logged in");
        selectedRestaurant.manageWaitingList(currentCustomer.getName());
        return Map.of("message", currentCustomer.getName() + " added to waiting list.");
    }

    // ── 9. PAY ────────────────────────────────────────────────
    @PostMapping("/pay")
    public Map<String, String> pay() {
        if (currentReservation == null) return Map.of("message", "No reservation found");
        Payment payment = new Payment(paymentAmount, currentReservation);
        payment.processPayment();

        FileManager fm = new FileManager("./data", "reservations", "txt");
        fm.saveToFile(List.of(currentReservation));

        return Map.of("message", "Payment successful", "receipt", payment.generateReceipt());
    }

    // ── 10. CANCEL ────────────────────────────────────────────
    @PostMapping("/cancel")
    public Map<String, String> cancel() {
        if (currentReservation == null) return Map.of("message", "No reservation");
        currentCustomer.cancelReservation(currentReservation);
        selectedRestaurant.cancelReservation(
                currentReservation.getTable().getTableNumber());
        return Map.of("message", "Reservation cancelled.");
    }

    // ── 11. VIEW RESERVATIONS ─────────────────────────────────
    @GetMapping("/reservations")
    public List<Map<String, String>> viewReservations() {
        List<Map<String, String>> list = new ArrayList<>();
        if (currentReservation != null) {
            list.add(Map.of(
                "reservationId", currentReservation.getReservationId(),
                "table",         String.valueOf(currentReservation.getTable().getTableNumber()),
                "date",          currentReservation.getReservationDate().toString(),
                "status",        currentReservation.getStatus()
            ));
        }
        return list;
    }