package Project;

import java.util.LinkedHashMap;
import java.util.Map;

public class Item {

    private int itemId;
    private String itemName;
    private String description;
    private double startingPrice;
    private double currentBid;
    private boolean isApproved;
    private int sellerId;

    public Item(int itemId, String itemName, String description,
                double startingPrice, int sellerId) {

        this.itemId = itemId;
        this.itemName = itemName;
        this.description = description;
        this.startingPrice = startingPrice;
        this.currentBid= startingPrice; 
        this.isApproved = false;         
        this.sellerId = sellerId;
    }

    
    public Map<String, Object> displayDetails() {

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("Item ID", itemId);
        details.put("Name", itemName);
        details.put("Description", description);
        details.put("Starting Price", startingPrice);
        details.put("Current Bid", currentBid);
        details.put("Approved", isApproved);
        details.put("Seller ID", 
                    sellerId);
        return details;
    }

    public void updateBid(double newBid) {
        if (newBid > currentBid) {
            currentBid = newBid;
        } else {
            System.out.println("Update failed — new bid must be higher than current bid.");
        }
    }

    public int    getItemId()        { return itemId; }
    public String getItemName()      { return itemName; }
    public String getDescription()   { return description; }
    public double getStartingPrice() { return startingPrice; }
    public double getCurrentBid()    { return currentBid; }
    public boolean isApproved()      { return isApproved; }
    public int    getSellerId()      { return sellerId; }

    public void setApproved(boolean approved) {
        this.isApproved = approved;
    }
}
