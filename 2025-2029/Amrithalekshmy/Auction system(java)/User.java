package Project;

import java.util.ArrayList;

public abstract class User {

    protected int userId;
    protected String name;
    protected String password;
    protected ArrayList<String> personalInfo;

    public User(String name, String password) {
        this.name         = name;
        this.password     = password;
        this.personalInfo = new ArrayList<>();
      
    }

  
    public boolean register() {

        for (User u : Database.users) {
            if (u.getName().equals(this.name)) {
                System.out.println("Registration failed — username already taken: " + this.name);
                return false;
            }
        }

       
        this.userId = Database.userIdCounter++;

        
        Database.users.add(this);

        System.out.println("Registered successfully — name: " + name + ", ID: " + userId);
        return true;
    }

    public static User login(String name, String password) {

        for (User u : Database.users) {
            if (u.getName().equals(name) && u.getPassword().equals(password)) {
                System.out.println("Login successful — welcome, " + name + "!");
                return u;
            }
        }

        System.out.println("Login failed — invalid name or password.");
        return null;
    }

    public int getUserId()        
    { return userId; }
    public String getName()                   
    { return name; }
    public String getPassword()                
    { return password; }
    public ArrayList<String> getPersonalInfo()  
    { return personalInfo; }

   
}
