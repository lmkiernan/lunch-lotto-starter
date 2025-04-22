const apiKey = "AIzaSyC47XrOijQWBir0G0UtB-cjdGy7wwx-VwM";
 const defaultSettings = {
   distance: 0.5,       // Default search radius in miles
   price: "2,3",        // Google Places API uses 1-4 ($ - $$$$)
   dietary: "",         // Empty means no filter (future: vegetarian, gluten-free, etc.)
 };
 // Convert miles to meters (Google Maps API uses meters)
 function milesToMeters(miles) {
   return miles * 1609.34;
 }
 
 function renderHistory() {
   chrome.storage.sync.get({ history: [] }, ({ history }) => {
     const list = document.getElementById('history-list');
     list.innerHTML = '';
     history.forEach(item => {
       const li = document.createElement('li');
       const time = new Date(item.timestamp).toLocaleString();
       li.innerHTML = `
         <a href="${item.link}" target="_blank">${item.name}</a>
         <span> — ${time}</span>
       `;
       list.appendChild(li);
     });
   });
 }
 
 function showProgress() {
   const bar = document.getElementById('api-progress');
   bar.style.display = 'block';
   bar.value = 0;
 }
 
 function updateProgress(pct) {
   const bar = document.getElementById('api-progress');
   bar.value = pct;
 }
 
 function hideProgress() {
   const bar = document.getElementById('api-progress');
   // small delay so the user sees 100%
   setTimeout(() => bar.style.display = 'none', 300);
 }
 
 // Load user settings or use defaults
 async function loadSettings() {
   return new Promise((resolve) => {
     chrome.storage.sync.get(defaultSettings, (settings) => {
       resolve(settings);
     });
   });
 }
 
 function showHistory() {
   document.getElementById('main-view').style.display     = 'none';
   document.getElementById('settings-view').style.display = 'none';
   document.getElementById('history-view').style.display  = 'block';
   renderHistory();    // Populate the <ul> with past picks
 }
 
 function hideHistory() {
   document.getElementById('history-view').style.display = 'none';
   document.getElementById('main-view').style.display    = 'block';
 }
 
 async function fetchRestaurants() {
  // 1) Kick off the loader
  showProgress();
  document.getElementById("loading-gif").style.display = "block";
  document.getElementById("wheel").style.display      = "none";

  // 2) Get location
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        updateProgress(20);
        const { latitude: lat, longitude: lng } = position.coords;
        const { distance, price } = await loadSettings();
  
        // Build your Foursquare URL (example)
        const meters = milesToMeters(distance);
        const url = `https://api.foursquare.com/v3/places/search`
                  + `?ll=${lat},${lng}`
                  + `&radius=${meters}`
                  + `&query=healthy%20restaurant`
                  + `&limit=30`;
        updateProgress(40);
  
        // Fetch with your FSQ key
        const response = await fetch(url, {
          headers: {
            "Accept": "application/json",
            "Authorization": FSQ_KEY
          }
        });
        updateProgress(60);
  
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
  
        const data = await response.json();
        updateProgress(80);
  
        if (!data.results || !data.results.length) {
          throw new Error("No places returned");
        }
  
        // Dedupe & map
        const seen = new Set();
        const restaurants = data.results
          .map(p => ({
            name: p.name,
            googleMapsLink: `https://foursquare.com/v/${p.fsq_id}`
          }))
          .filter(r => seen.has(r.name) ? false : seen.add(r.name));
  
        // 3) After your 2s “spinner” delay, show the wheel
        setTimeout(() => {
          document.getElementById("loading-gif").style.display = "none";
          document.getElementById("wheel").style.display      = "block";
          updateWheel(restaurants);

          updateProgress(100);
          hideProgress();
        }, 2000);

      } catch (err) {
        console.error("Fetch error:", err);
        // On any error, hide the loader and show the wheel
        hideProgress();
        document.getElementById("loading-gif").style.display = "none";
        document.getElementById("wheel").style.display      = "block";
        alert("Error fetching places: " + err.message);
      }
    },
    (geoErr) => {
      console.error("Geolocation error:", geoErr);
      hideProgress();
      document.getElementById("loading-gif").style.display = "none";
      document.getElementById("wheel").style.display      = "block";
      alert("Please enable location access.");
    }
  );
}
 
   function updateWheel(restaurants) {
     options.length = 0; // Clear the current options array
 
     // Randomly shuffle the restaurants array
     const shuffledRestaurants = [...restaurants].sort(() => Math.random() - 0.5);
 
     // Choose 8 random restaurants
     const selectedRestaurants = shuffledRestaurants.slice(0, 8);
 
     // Extract restaurant names and Google Maps links, and populate options array
     options.push(...selectedRestaurants.map((restaurant) => ({
       name: restaurant.name,
       googleMapsLink: restaurant.googleMapsLink, // Add Google Maps link
     })));
 
     // Debugging: Log the selected restaurants with their links
     console.log("✅ Options for the Wheel:", options);
 
     // Store full restaurant details, including names and links
     restaurantDetails = selectedRestaurants.map((restaurant) => ({
       name: restaurant.name,
       googleMapsLink: restaurant.googleMapsLink // Add the Google Maps link
     }));
 
     console.log("✅ Selected Restaurants for the Wheel:", restaurantDetails);
 
     // Redraw the wheel with the updated options
     drawWheel();
   }  
 
 // 🛠️ Toggle Settings View
 function showSettings() {
   document.getElementById("main-view").style.display = "none";
   document.getElementById("settings-view").style.display = "block";
 }
 
 function hideSettings() {
   document.getElementById("main-view").style.display = "block";
   document.getElementById("settings-view").style.display = "none";
 }
 
 // Ensure scripts run only after DOM is loaded
 document.addEventListener("DOMContentLoaded", async () => {
   await fetchRestaurants();
 
   // Spin button event
   document.getElementById("spin").addEventListener("click", () => spin());
 
   // Open settings view
   document.getElementById("open-settings").addEventListener("click", showSettings);
 
   // Close settings view
   document.getElementById("close-settings").addEventListener("click", hideSettings);
 
   document.getElementById("open-history").addEventListener("click", showHistory);
   document.getElementById("close-history").addEventListener("click", hideHistory);
 
   // Load saved settings into inputs
   const settings = await loadSettings();
   document.getElementById("distance").value = settings.distance;
   document.getElementById("price").value = settings.price;
 
   // Save settings
   document.getElementById("save-settings").addEventListener("click", async () => {
     const distance = parseFloat(document.getElementById("distance").value);
     const price = document.getElementById("price").value;
 
     // Save the updated settings
     chrome.storage.sync.set({ distance, price }, async () => {
       swal({
         title: `Settings saved!`,
         icon: "success",
         button: false, // Hide the default OK button
       });
 
       // Hide the settings view and fetch new restaurants
       hideSettings();
       await fetchRestaurants(); // Fetch restaurants with the new settings
     });
   });  
  });