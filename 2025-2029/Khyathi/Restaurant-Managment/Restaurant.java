package com.example.demo.model;

import java.util.ArrayList;
import java.util.List;

class Restaurant {
    private String restaurantID;
    private String name;
    private String address;
    private String openingHours;
    private ArrayList<Table> tableList = new ArrayList<>();
    private ArrayList<String> waitingList = new ArrayList<>();

    public Restaurant(String restaurantID, String name, String address, String openingHours) {
        this.restaurantID = restaurantID;
        this.name = name;
        this.address = address;
        this.openingHours = openingHours;
    }

    public void addTable(Table table) {
        tableList.add(table);
        System.out.println("Table added successfully.");
    }

    public void removeTable(int tableNo) {
        for (int i = 0; i < tableList.size(); i++) {
            if (tableList.get(i).getTableNumber() == tableNo) {
                tableList.remove(i);
                System.out.println("Table removed successfully.");
                return;
            }
        }
        System.out.println("Table not found.");
    }

    public void manageWaitingList(String customerName) {
        waitingList.add(customerName);
        System.out.println(customerName + " added to waiting list.");
    }

    public void cancelReservation(int tableNo) {
        for (Table table : tableList) {
            if (table.getTableNumber() == tableNo) {
                table.setAvailability(true);
                System.out.println("Reservation cancelled for Table " + tableNo);

                if (!waitingList.isEmpty()) {
                    String nextCustomer = waitingList.remove(0);
                    table.setAvailability(false);
                    System.out.println(nextCustomer + " got the table from waiting list.");
                }
                return;
            }
        }
        System.out.println("Table not found.");
    }

    public Table findAvailableTable(int requiredCapacity) {
        for (Table table : tableList) {
            if (table.isAvailable() && table.getCapacity() >= requiredCapacity) {
                return table;
            }
        }
        return null;
    }

    public void showRestaurantDetails() {
        System.out.println("Restaurant ID : " + restaurantID);
        System.out.println("Name          : " + name);
        System.out.println("Address       : " + address);
        System.out.println("Opening Hours : " + openingHours);
    }

	public String getRestaurantName() {
		// TODO Auto-generated method stub
		return name;
	}

	public List<Table> getTables() {
	    return tableList;
	}	}
