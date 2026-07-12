package Project;

import java.time.LocalDateTime;

public class Bid {

    private int bidId;
    private double bidAmount;
    private LocalDateTime bidTime;
    private int itemId;
    private int buyerId;

    
    public Bid(int bidId, double bidAmount, int buyerId, int itemId) {
        this.bidId     = bidId;
        this.bidAmount = bidAmount;
        this.buyerId   = buyerId;
        this.itemId    = itemId;
        this.bidTime   = LocalDateTime.now(); 
    }

    public static double getHighestBid(int itemId) {

        double highest = 0;

        for (Bid b : Database.bids) {
            if (b.getItemId() == itemId) {
                if (b.getBidAmount() > highest) {
                    highest = b.getBidAmount();
                }
            }
        }

        return highest;
    }

    public static Bid getWinningBid(int itemId) {

        Bid winningBid    = null;
        double highest    = 0;

        for (Bid b : Database.bids) {
            if (b.getItemId() == itemId) {
                if (b.getBidAmount() > highest) {
                    highest    = b.getBidAmount();
                    winningBid = b;
                }
            }
        }

        return winningBid;
    }

    
    public int              getBidId()     { return bidId; }
    public double           getBidAmount() { return bidAmount; }
    public int              getBuyerId()   { return buyerId; }
    public int              getItemId()    { return itemId; }
    public LocalDateTime    getBidTime()   { return bidTime; }
}