package Project;

public class Seller extends User {

    public Seller(String name, String password) {
        super(name, password);
    }

    public Item addItem(String itemName, String description, double startingPrice) {

        Item newItem = new Item(Database.itemIdCounter++,itemName,description,startingPrice,this.userId );

        Database.items.add(newItem);

        System.out.println("Item added (pending admin approval) — " + itemName
                         + " | Starting price: " + startingPrice
                         + " | Item ID: " + newItem.getItemId());

        return newItem;
    }

    public boolean auctionClose(int auctionId) {

        for (Auction a : Database.auctions) {
            if (a.getAuctionId() == auctionId) {

                if (a.getSellerId() != this.userId) {
                    System.out.println("Access denied — you do not own this auction.");
                    return false;
                }

                return a.closeAuction();
            }
        }

        System.out.println("Auction not found of ID: " + auctionId);
        return false;
    }

    public void contactBidder(int buyerId, String message) {

        for (User u : Database.users) {
            if (u.getUserId() == buyerId) {
                System.out.println("Message sent to " + u.getName() + ": " + message);
                return;
            }
        }

        System.out.println("Buyer not found of ID: " + buyerId);
    }
}
