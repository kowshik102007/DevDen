package Project;

import java.util.ArrayList;

public class Admin {

    private int adminId;
    private String password;

    public Admin(int adminId, String password) {
        this.adminId  = adminId;
        this.password = password;
    }
    public void manageMembers(int userId, String action) {

        if (action.equals("remove")) {
            boolean removed = Database.users.removeIf(u -> u.getUserId() == userId);
            if (removed) {
                System.out.println("User removed successfully of ID: " + userId);
            } else {
                System.out.println("User not found of ID: " + userId);
            }

        } else {
            System.out.println("Unknown action: " + action);
        }
    }

    public boolean approveProducts(int itemId) {

        for (Item item : Database.items) {
            if (item.getItemId() == itemId) {
                item.setApproved(true);
                System.out.println("Item approved — " + item.getItemName()
                                 + " | ID: " + itemId);
                return true;
            }
        }

        System.out.println("Item not found — ID: " + itemId);
        return false;
    }

    public void viewBidDetails(int auctionId) {

        for (Auction a : Database.auctions) {
            if (a.getAuctionId() == auctionId) {

                int itemId = a.getItem().getItemId();

                System.out.println("========== Bid Details — Auction "
                                 + auctionId + " ==========");

                boolean found = false;
                for (Bid b : Database.bids) {
                    if (b.getItemId() == itemId) {
                        System.out.println("Bid ID  : " + b.getBidId()+ " | Amount  : " + b.getBidAmount()+ " | Buyer ID: " + b.getBuyerId()
                                         + " | Time    : " + b.getBidTime());
                        found = true;
                    }
                }

                if (!found) {
                    System.out.println("No bids placed yet.");
                }

                System.out.println("=============================================");
                return;
            }
        }

        System.out.println("Auction not found — ID: " + auctionId);
    }

    public int getAdminId()     { return adminId; }
    public String getPassword() { return password; }
}