package com.example.demo.controller;

import com.example.demo.service.ReservationService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "*")
public class RestaurantController {

    @Autowired
    ReservationService service;

    // TEST API
    @GetMapping("/test")
    public String test() {
        return "Backend working!";
    }

    // RESERVE API
    @PostMapping("/reserve")
    public String reserve(

            @RequestParam String customerId,
            @RequestParam String customerName,
            @RequestParam long phone,
            @RequestParam int capacity

    ) {

        return service.reserveTable(
                customerId,
                customerName,
                phone,
                capacity
        );
    }
}