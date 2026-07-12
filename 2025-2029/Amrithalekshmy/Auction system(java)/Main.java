package Project;

public class Main {

    public static void main(String[] args) {

        System.out.println("\n==========REGISTRATION ==========");

        Seller tristan = new Seller("Tristan", "t569");
        tristan.register();

        Buyer judy = new Buyer("Judy", "j893");
        judy.register();

        Buyer river = new Buyer("River", "river308");
        river.register();


        System.out.println("\n========== LOGIN ==========");

        Seller t = (Seller) User.login("Tristan", "t569");
        Buyer  j  = (Buyer)  User.login("Judy", "j893");
        Buyer  r = (Buyer)  User.login("River", "river308");

        
        if (t == null || j == null || r == null) {
            System.out.println("Login failed.");
            return;
        }


        System.out.println("\n========== SELLER ADDS ITEM ==========");

        Item headset = t.addItem("Meta Quest 3", "VR Headset, 128GB", 27000);


        System.out.println("\n========== ADMIN APPROVES ITEM ==========");

        Admin admin = new Admin(909, "admin#06-04");
        admin.approveProducts(headset.getItemId());


        System.out.println("\n========== AUCTION STARTS ==========");

        Auction auction = new Auction(Database.auctionIdCounter++,headset,t.getUserId()
        );
        Database.auctions.add(auction);
        auction.startAuction();


        System.out.println("\n========== FIRST BUYER VIEWS ITEM ==========");

        		j.viewItem(headset.getItemId());


        System.out.println("\n========== FIRST BUYER PLACES BID ==========");

        j.placeBids(headset.getItemId(), 30000);
        
        System.out.println("\n========== SECOND BUYER VIEWS ITEM ==========");

		r.viewItem(headset.getItemId());

        System.out.println("\n========== SECOND BUYER PLACES HIGHER BID ==========");

        r.placeBids(headset.getItemId(), 34500);


        System.out.println("\n========== FIRST BUYER TRIES LOWER BID ==========");

        j.placeBids(headset.getItemId(), 33000);


        System.out.println("\n==========  ADMIN VIEWS BID DETAILS ==========");

        admin.viewBidDetails(auction.getAuctionId());


        System.out.println("\n========== SELLER CLOSES AUCTION ==========");

        t.auctionClose(auction.getAuctionId());


        System.out.println("\n========== BUYERS VIEW RESULTS ==========");

        j.viewResults(auction.getAuctionId());
        r.viewResults(auction.getAuctionId());


        System.out.println("\n========== SELLER CONTACTS WINNER ==========");

        Buyer winner = auction.declareWinner();
        if (winner != null) {
           t.contactBidder(winner.getUserId(),
                "Congratulations " + winner.getName() +
                "! Please share your delivery address.");
        }
    }
}
