package Project;
public class Buyer extends User {

   
    public Buyer(String name, String password) {
        super(name, password);
    }

    
    public Item viewItem(int itemId) {

        for (Item item : Database.items) {
            if (item.getItemId() == itemId) {

                if (!item.isApproved()) {
                    System.out.println("Item is not available yet — waiting for admin approval.");
                    return null;
                }
                System.out.println("==========================================");
                System.out.println("Item ID      : " + item.getItemId());
                System.out.println("Name         : " + item.getItemName());
                System.out.println("Description  : " + item.getDescription());
                System.out.println("Starting Price: " + item.getStartingPrice());
                System.out.println("Current Bid  : " + item.getCurrentBid());
                System.out.println("==========================================");

                return item;
            }
        }

        System.out.println("Item not found of ID: " + itemId);
        return null;
    }

    public boolean placeBids(int itemId, double amount) {

        Item targetItem = null;
        for (Item item : Database.items) {
            if (item.getItemId() == itemId) {
                targetItem = item;
                break;
            }
        }

        if (targetItem == null) {
            System.out.println("Bid failed — item not found: " + itemId);
            return false;
        }

        Auction targetAuction = null;
        for (Auction a : Database.auctions) {
            if (a.getItem().getItemId() == itemId && a.isActive()) {
                targetAuction = a;
                break;
            }
        }

        if (targetAuction == null) {
            System.out.println("Bid failed — no active auction found for item: " + itemId);
            return false;
        }

    
        if (amount <= targetItem.getCurrentBid()) {
            System.out.println("Bid failed — your bid -" + amount
                             +" must be higher than current bid - "
                             + targetItem.getCurrentBid()) ;
            return false;
        }

        Bid newBid = new Bid(Database.bidIdCounter++,amount,this.userId,itemId);
        Database.bids.add(newBid);

        targetItem.updateBid(amount);

        System.out.println("Bid placed successfully — " + this.name
                         + " bid " + amount
                         + " on " + targetItem.getItemName());
        return true;
    }

    public Auction viewResults(int auctionId) {

        for (Auction a : Database.auctions) {
            if (a.getAuctionId() == auctionId) {

                if (a.isActive()) {
                    System.out.println("Auction is still active — results not available yet.");
                    return null;
                }

                System.out.println("==========================================");
                System.out.println("Auction ID   : " + a.getAuctionId());
                System.out.println("Item         : " + a.getItem().getItemName());

                if (a.getHighestBid() != null) {
                    System.out.println("Winning Bid  : " + a.getHighestBid().getBidAmount());
                    System.out.println("Winner ID    : " + a.getHighestBid().getBuyerId());
                } else {
                    System.out.println("No bids were placed — no winner.");
                }
                System.out.println("==========================================");

                return a;
            }
        }

        System.out.println("Auction not found — ID: " + auctionId);
        return null;
    }
}
