# Lost & Found Platform

A modern, responsive **Lost & Found web application** designed to help
users report, search, and recover lost belongings efficiently.

## Problem Statement

Losing personal belongings in campuses, public spaces, or events often
leads to confusion and poor recovery rates due to the lack of a
centralized reporting system.

The **Lost & Found Platform** solves this problem by providing: - A
centralized system to report lost/found items - Search and filtering
functionality - Image-based identification - Direct contact options -
Organized item management

## Features

### Item Management

-   Post **Lost Items**
-   Post **Found Items**
-   Edit existing posts
-   Delete posts
-   Update item status

### Image Upload

-   Upload item photos using **Firebase Storage**
-   Image preview before posting
-   Drag-and-drop image support
-   Upload progress tracking

### Search & Filtering

Search by: - Item title - Description - Location - Contact details

### Dashboard

-   View all personal posts
-   Manage uploaded items
-   Edit item details
-   Track status

### Contact Features

-   Contact information on item cards
-   Contact page with:
    -   Team contact information
    -   Social links (GitHub & LinkedIn)
    -   Embedded Google Maps location
    -   Firebase-powered contact form

### Authentication

-   Firebase Authentication
-   User login/logout
-   Protected routes

### Responsive UI

Fully responsive across: - Mobile - Tablet - Desktop

## Tech Stack

### Frontend

-   HTML5
-   CSS3
-   JavaScript (ES6 Modules)
-   Tailwind CSS

### Backend & Database

-   Firebase Firestore
-   Firebase Storage
-   Firebase Authentication

### Hosting

-   GitHub Pages

## Project Structure

```text
Lost-and-Found/
├── index.html
├── login.html
├── forgot-password.html
├── post.html
├── lost.html
├── found.html
├── dashboard.html
├── contact.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── auth.js
│   ├── firebase.js
│   ├── posts.js
│   ├── search.js
│   ├── dashboard.js
│   ├── ui.js
│   └── contact.js
├── assets/
│   ├── Adithyanandan.png
│   ├── Ganesh.png
│   ├── rahul.jpeg
│   └── Yazeen.jpeg
```

## Firebase Collections

-   `lostItems`
-   `foundItems`
-   `contactMessages`

## Setup

### Clone Repository

``` bash
git clone https://github.com/YOUR_USERNAME/Lost-and-Found.git
cd Lost-and-Found
```

### Configure Firebase

Enable: - Firestore Database - Firebase Authentication - Firebase
Storage

Add Firebase config inside:

`js/firebase.js`

### Run Locally

Using VS Code Live Server:

``` text
Right Click → Open with Live Server
```

Or:

``` bash
python -m http.server
```

## Future Improvements

-   AI-powered item matching
-   Email notifications
-   Admin dashboard for messages
-   Claim verification workflow
-   Real-time chat support

## Contributors

-   **Rahul R Nair**
-   **Adithyanandan Arun**
-   **Ganesh S**
-   **Muhammad Yazeen**

## Academic Purpose

This project was developed as a **college team project** to explore: -
Frontend Development - Firebase Integration - Authentication Systems -
Cloud Databases - Full Stack Development

## License

This project is intended for **educational and academic purposes**.
