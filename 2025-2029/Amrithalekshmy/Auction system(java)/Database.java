package Project;

import java.util.ArrayList;

public class Database {

    public static ArrayList<User>  users = new ArrayList<>();
    public static ArrayList<Item>  items = new ArrayList<>();
    public static ArrayList<Bid>   bids  = new ArrayList<>();
    public static ArrayList<Auction> auctions = new ArrayList<>();

    public static int userIdCounter = 1;
    public static int itemIdCounter = 1;
    public static int bidIdCounter  = 1;
    public static int auctionIdCounter = 1;
}
