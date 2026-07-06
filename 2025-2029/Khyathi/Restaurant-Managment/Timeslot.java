package com.example.demo.model;

class Timeslot {
    private String timeslotId;
    private String startTime;
    private String endTime;
    private boolean available;

    public Timeslot(String timeslotId, String startTime, String endTime, boolean available) {
        this.timeslotId = timeslotId;
        this.startTime = startTime;
        this.endTime = endTime;
        this.available = available;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    @Override
    public String toString() {
        return timeslotId + " (" + startTime + " - " + endTime + ")";
    }
}