package Project;

public class Auction {

    private int auctionId;
    private Item item;
    private int sellerId;
    private boolean isActive;
    private Bid highestBid;

    public Auction(int auctionId, Item item, int sellerId) {
        this.auctionId  = auctionId;
        this.item       = item;
        this.sellerId   = sellerId;
        this.isActive   = true;  
        this.highestBid = null;  
    }
    public void startAuction() {

        if (!isActive) {
            System.out.println("Cannot start — auction is already closed.");
            return;
        }

        System.out.println("==========================================");
        System.out.println("Auction STARTED");
        System.out.println("Auction ID   : " + auctionId);
        System.out.println("Item         : " + item.getItemName());
        System.out.println("Starting Price: " + item.getStartingPrice());
        System.out.println("==========================================");
    }

    
    public boolean closeAuction() {

        if (!isActive) {
            System.out.println("Auction is already closed of ID: " + auctionId);
            return false;
        }

        isActive = false;
        System.out.println("Auction Closed: " + item.getItemName());

       
        declareWinner();

        return true;
    }

    public Buyer declareWinner() {

        Bid winningBid = Bid.getWinningBid(item.getItemId());

        if (winningBid == null) {
            System.out.println("No bids were placed — no winner for: "
                             + item.getItemName());
            return null;
        }
        this.highestBid = winningBid;
        for (User u : Database.users) {
            if (u.getUserId() == winningBid.getBuyerId()) {
                Buyer winner = (Buyer) u;
                System.out.println("==========================================");
                System.out.println("WINNER DECLARED");
                System.out.println("Item         : " + item.getItemName());
                System.out.println("Winner       : " + winner.getName());
                System.out.println("Winning Bid  : " + winningBid.getBidAmount());
                System.out.println("==========================================");
                return winner;
            }
        }

        System.out.println("Winner buyer not found in system.");
        return null;
    }

    
    public int     getAuctionId()  { return auctionId; }
    public Item    getItem()       { return item; }
    public int     getSellerId()   { return sellerId; }
    public boolean isActive()      { return isActive; }
    public Bid     getHighestBid() { return highestBid; }
}