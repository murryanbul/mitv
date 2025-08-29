# 📺 Ultimate Perfect IPTV – Web Player UI

A modern, responsive **HTML5 IPTV web player** that allows you to connect to an IPTV portal, browse channels, movies, and series, and play streams directly in the browser.  
Built with **Bootstrap 5**, **Font Awesome**, **Video.js**, and **mpegts.js**, it features a sleek dark UI with glassmorphism effects.

---

## ✨ Features

- 🔌 **Server Connection Modal**  
  Enter IPTV portal URL & MAC address to authenticate.  

- 📡 **Connection Status Tracking**  
  Shows live, connecting, and disconnected states.  

- 🗂️ **Category & Genre Browsing**  
  Sidebar with search, refresh, and filtering.  

- 🎞️ **Content Navigation**  
  Switch between **Live TV**, **Movies**, and **TV Series** tabs.  

- 🔍 **Advanced Search**  
  Category-based and global search with instant results.  

- 🎥 **Embedded Video Player**  
  Powered by **Video.js** with controls for:
  - Play / Stop  
  - Copy stream link  
  - Minimize / Restore  
  - Picture-in-Picture  
  - Fullscreen  

- 📑 **Grid & Table Views**  
  Toggle between card layout and data table.  

- 🕒 **Recently Watched & Favorites**  
  Sidebar sections to quickly rewatch or save items.  

- 🔄 **Infinite Scroll & Pagination**  
  Smooth auto-load for more content.  

- 📱 **Responsive Design**  
  Optimized for desktop, tablet, and mobile.  

- 🔔 **Toast Notifications**  
  Success, error, and info messages.  

---

## 🛠️ Tech Stack

- **HTML5, CSS3** (dark theme + glassmorphism)
- [Bootstrap 5](https://getbootstrap.com)
- [Font Awesome](https://fontawesome.com)
- [Video.js](https://videojs.com)
- [mpegts.js](https://github.com/xqq/mpegts.js)

---

## 🚀 Getting Started

1. **Clone this repository**  

   ```bash
   git clone https://github.com/<your-username>/<your-repo-name>.git
   cd <your-repo-name>
   ```

2. **Open the player**  
   Simply open the `MITV2.html` file in your browser:

   ```bash
   open MITV2.html     # macOS
   xdg-open MITV2.html # Linux
   start MITV2.html    # Windows
   ```

3. **Connect to your IPTV server**  

   - Enter your **Server URL** (e.g., `http://example.com`)  
   - Enter your **MAC Address** (e.g., `00:1A:79:XX:XX:XX`)  
   - Click **Connect to Server**  

4. Start browsing **Live TV, Movies, or TV Series** 🎬  

---

## 📂 Project Structure

```
.
├── MITV2.html             # Main IPTV Web Player UI
├── assets
│   ├── css
│   │   └── styles.css     # Extracted styles
│   └── js
│       └── app.js         # Application logic
└── README.md              # Project documentation
```

---

## 📸 Screenshots

> *(Optional — add screenshots of your UI here!)*

---

## ⚠️ Disclaimer

This project is a **frontend IPTV player UI only**.  
It does not provide any streams or content.  
You must connect it to your own IPTV portal/server.  

---

## 📜 License

This project is released under the **MIT License**.  
See [LICENSE](LICENSE) for details.
