# Teleconsultation-web-rtc-
Teleconsultation using WebRTC is a real-time video communication platform designed to connect patients and healthcare providers remotely. Built on WebRTC (Web Real-Time Communication) technology.




---------------------------------------------------------------------------------
teleconsultation WEB-RTC is a modern built with WebRTC, Socket.IO, Node.js, Express, and a dynamic frontend. It allows users to create and join video meeting rooms, send chat messages, share files, and even take and send photos during a call. The user interface features a clean, hospital-themed design with interactive background elements.
---------------------------------------------------------------------------------
Features:

Video Conferencing: Real-time peer-to-peer video and audio communication.

Room Management: Create unique meeting rooms or join existing ones.

Usernames: Display user-friendly names for participants.

Chat Functionality: Send text messages during a call.

File Sharing: Upload and share files within the chat.

Photo Capture: Take pictures using your camera during a call and send them in chat.

Responsive UI: Adapts to different screen sizes (desktop and mobile).

Modern Design: Clean, hospital-themed aesthetic with subtle gradients and animated background stickers.

Interactive Puppy Icon: A fun, clickable puppy icon that moves to random locations outside the main UI.
----------------------------------------------------------------------------------------------------------------------------------------------------------------
Prerequisites to run this application you need:

Node.js: (LTS version recommended) installed on your machine. You can download it from nodejs.org.

npm: (Node Package Manager) which comes bundled with Node.js.


Installation

1) Clone or Download the Project:

If you have a Git repository, clone it:
=================================================================================
git clone <your-repository-url>
cd <your-project-folder>
=================================================================================

Otherwise, download the project files and navigate to the project's root directory in your terminal.

---------------------------------------------------------------------------------------------------------------------------------------------------------------


2)Install Node.js Dependencies:

From the project's root directory (where server.js and package.json are located), open your Command Prompt (Windows) or Terminal (macOS/Linux).

The easiest way to install all required backend modules is to run:
================================================================================
npm install
================================================================================
This command automatically installs all dependencies listed in the package.json file. For this project, the required modules are:

-express: A fast, unopinionated, minimalist web framework for Node.js, used for handling HTTP routes and serving static files.

-socket.io: A library that enables real-time, bidirectional, event-based communication between web clients and servers. It's used here for WebRTC signaling and chat fallback.

-multer: A Node.js middleware for handling multipart/form-data, primarily used for file uploads.

Alternatively, you can install them one by one, though npm install is generally preferred:
=================================================================================
npm install express
npm install socket.io
npm install multer
=================================================================================

------------------------------------------------------------------------------------------------------------------------------------------


Running the Application

Important Note: This application requires a backend server (server.js) to handle WebRTC signaling, room management, and file uploads. You cannot simply open index.html in your browser to run the full application.

1)Start the Node.js Server:
From the project's root directory in your terminal, run:
=================================================================================

node server.js

=================================================================================
You should see a message like: Server running on http://localhost:3000

2) Access the Application in Your Browser:
Open your web browser and go to:

=================================================================================
http://localhost:3000
=================================================================================

3) Test the Video Chat:

Open two separate browser tabs or windows (or even different browsers) and navigate to http://localhost:3000 in each.

In the first tab, enter a username and click "Create Meeting". Note the Room ID.

In the second tab, enter a different username and the Room ID from the first tab, then click "Join Meeting".

You should now be connected in a video call!

File Structureyour-project-folder/
=================================================================================

├── node_modules/         # Installed Node.js dependencies
├── public/               # Frontend files served statically
│   ├── index.html        # Main application HTML
│   ├── style.css         # All application styling (including stickers, puppy)
│   ├── script-base.js    # Core DOM element definitions and UI functions
│   ├── script-logic.js   # WebRTC, Socket.IO, and interactive logic (e.g., puppy movement)
│   └── images/           # IMPORTANT: Place your sticker and puppy PNGs here
│       ├── band-aid.png
│       ├── doctor-notes.png
│       ├── drugs.png
│       ├── mmh.png
│       ├── puppy_icon.png  # Ensure this is a transparent PNG!
│       ├── stetoscope.png
│       └── syringe.png
├── uploads/              # Directory for uploaded files (created by multer)
├── server.js             # Node.js backend server
├── package.json          # Project metadata and dependencies
└── package-lock.json     # Dependency tree lock file
=================================================================================


Important Notes for Customization!!!

Sticker Images: Ensure your .png image files for the stickers and the puppy_icon.png are placed in the public/images/ directory. The style.css references these paths directly.

Puppy Icon Transparency: For the best visual effect, make sure your puppy_icon.png has a transparent background. You can use online tools like remove.bg for this.

Browser Caching: When making changes to HTML, CSS, or JavaScript files, always perform a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) in your browser with the Developer Tools open and "Disable cache" checked to ensure you see the latest updates.

Server Restart: After making any changes to server.js or adding/removing files in the public directory, you must restart your Node.js server (Ctrl+C then node server.js) for the changes to take effect.
